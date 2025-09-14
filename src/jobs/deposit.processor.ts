import Wallet from "../models/Wallet";
import Asset from "../models/Asset";
import Transaction from "../models/Transaction";
import UserBalance from "../models/UserBalance";
import { depositQueue, type TatumIncomingPayload } from "./queue";
import { confirmTransaction } from "../helpers/tatum/confirm";
import { mapTatumChainToInternalNetwork, toWalletNetwork } from "../helpers/tatum/mapping";
import { relocateFundsToLiquidityWallet, sendFromLiquidityWallet } from "../utils/funds";

// Initialize processor

depositQueue.setProcessor(async (payload: TatumIncomingPayload) => {
  const { currency, address, blockNumber, txId, chain, subscriptionType, amount, contractAddress } = payload;
  const amountNum = Number(amount);
  if (!address || !txId || !chain || !subscriptionType || !amountNum) {
    console.warn("Deposit job missing fields, skipping", payload);
    return;
  }

  // Confirm on-chain inclusion (skip in development environment to avoid network calls during tests)
  const IS_DEV_ENV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';
  let confirmed = true;
  if (!IS_DEV_ENV) {
    confirmed = await confirmTransaction({ txId, chain, blockNumber: Number(blockNumber) });
  } else {
    console.log(`Development environment detected (CURRENT_ENVIRONMENT=DEVELOPMENT). Skipping on-chain verification for tx ${txId}.`);
  }
  if (!confirmed) {
    console.log(`Tx ${txId} not yet confirmed; skipping for now.`);
    return; // In-memory queue: simple drop; webhook resend will re-enqueue
  }

  // Find base wallet by chain address
  let baseWallet = await Wallet.findOne({ address });
  if (!baseWallet) {
    console.error(`Wallet not found for address ${address}`);
    return;
  }

  // Idempotency
  const existing = await Transaction.findOne({ txHash: txId });
  if (existing) {
    console.log(`Transaction ${txId} already recorded; skipping.`);
    return;
  }

  const internalNet = mapTatumChainToInternalNetwork(chain);
  const walletNet = toWalletNetwork(internalNet);

  let assetDoc = await Asset.findById(baseWallet.assetId);

  const isToken = subscriptionType === 'INCOMING_FUNGIBLE_TX' && !!contractAddress;

  // If token, resolve Asset from configured token list (do not create per-token wallets)
  if (isToken) {
    const tokenAsset = await Asset.findOne({ tokenAddress: contractAddress, network: walletNet });

    if (!tokenAsset) {
      // No Asset configured for this token: record pending transaction and exit
      await Transaction.create({
        user: baseWallet.userId,
        type: 'deposit',
        amount: amountNum,
        asset: currency || 'UNKNOWN',
        status: 'pending',
        txHash: txId,
        network: walletNet,
        contractAddress: contractAddress,
        // audit fields
        grossAmount: amountNum,
        netAmount: amountNum,
        feePercent: 0,
        feeAmount: 0,
      });
      return;
    }

    assetDoc = tokenAsset;
  }

  // Apply receive fee when crediting user balance by account type
  let receiveFeePercent = 0;
  try {
    // Lazy import User to avoid import cycles
    const { default: User, AccountType } = await import("../models/User");
    const user = await User.findById(baseWallet.userId).select('accountType');
    const acct = user?.accountType || AccountType.REG;
    // @ts-ignore
    receiveFeePercent = Number(assetDoc?.fees?.receiveFeePercent?.[acct] ?? 0);
  } catch {}
  const netAmount = amountNum * (1 - receiveFeePercent / 100);

  // Determine if this address is a loan collateral wallet
  const loanCollateral = await Wallet.findOne({ _id: baseWallet._id, isLoanCollateral: true, loanId: { $ne: null } });

  if (loanCollateral) {
    // Deposit to a loan-linked wallet. Determine whether this is collateral top-up or external repayment.
    const Loan = (await import('../models/Loan')).default;
    const loan = await Loan.findById(loanCollateral.loanId);
    if (!loan) {
      console.warn('Collateral wallet has no matching loan:', loanCollateral.loanId);
      return;
    }

    // Identify deposit asset symbol
    const depositSymbol = assetDoc ? String(assetDoc.symbol) : String(currency || '');
    const borrowAsset = await Asset.findById(loan.loanAssetId);
    const isRepayment = depositSymbol.toUpperCase() === String(borrowAsset?.symbol || '').toUpperCase();

    if (isRepayment) {
      // Repayment flow: reduce principal, record repayment, optionally relocate to liquidity
      await Transaction.create({
        user: baseWallet.userId,
        type: 'loan-repayment',
        amount: netAmount,
        asset: depositSymbol,
        status: 'completed',
        txHash: txId,
        network: walletNet,
        contractAddress: isToken ? contractAddress : undefined,
        grossAmount: amountNum,
        netAmount: netAmount,
        feePercent: receiveFeePercent,
        feeAmount: amountNum - netAmount,
        loanId: loan._id,
      });

      // Reduce principal by net amount (after receive fee)
      const newAmount = Math.max(0, Number(loan.loanAmount || 0) - netAmount);
      loan.loanAmount = newAmount;
      if (newAmount <= 0) {
        loan.status = 'REPAID' as any;
      }
      await loan.save();

      // Relocate funds to liquidity (production only)
      if (!IS_DEV_ENV) {
        try {
          if (isToken) {
            const kind = internalNet.startsWith('TRON') ? 'trc20' : 'erc20';
            await relocateFundsToLiquidityWallet(String(baseWallet._id), {
              amount: amountNum,
              kind,
              tokenAddress: contractAddress!,
              decimals: assetDoc?.decimals,
            });
          } else {
            await relocateFundsToLiquidityWallet(String(baseWallet._id), amountNum);
          }
        } catch (e) {
          console.error('Relocation failed for repayment tx:', txId, e);
        }
      }

      return;
    }

    // Collateral deposit flow: do NOT credit spendable user balance.
    await Transaction.create({
      user: baseWallet.userId,
      type: 'deposit',
      amount: netAmount,
      asset: assetDoc ? assetDoc.symbol : currency,
      status: 'confirmed',
      txHash: txId,
      network: walletNet,
      contractAddress: isToken ? contractAddress : undefined,
      grossAmount: amountNum,
      netAmount: netAmount,
      feePercent: receiveFeePercent,
      feeAmount: amountNum - netAmount,
      loanId: loan._id,
    });

    // Accumulate collateral received
    loan.collateralReceivedAmountToken = (loan.collateralReceivedAmountToken || 0) + netAmount;

    // Adjust borrow amount to match LTV if collateral is still below expected at time of disbursement check.
    // We only adjust now if collateral >= expected (we will disburse). Otherwise, keep waiting for more.

    const metRequirement = (loan.collateralReceivedAmountToken || 0) >= (loan.expectedCollateralAmountToken || 0);

    // Relocate collateral to liquidity (prod only)
    if (!IS_DEV_ENV) {
      try {
        if (isToken) {
          const kind = internalNet.startsWith('TRON') ? 'trc20' : 'erc20';
          await relocateFundsToLiquidityWallet(String(baseWallet._id), {
            amount: amountNum,
            kind,
            tokenAddress: contractAddress!,
            decimals: assetDoc?.decimals,
          });
        } else {
          await relocateFundsToLiquidityWallet(String(baseWallet._id), amountNum);
        }
      } catch (e) {
        console.error('Relocation failed for collateral tx:', txId, e);
      }
    }

    // Compute allowed disbursement based on received collateral and target LTV (best practice: LTV = loan/collateral)
    if (loan.status === 'PENDING_COLLATERAL') {
      const borrowAsset = await Asset.findById(loan.loanAssetId);
      const collateralAssetForPricing = await Asset.findById(loan.collateralAssetId);
      const { getUsdPriceForAsset } = await import('../helpers/tatum/rates');
      const borrowUsd = IS_DEV_ENV ? Number(borrowAsset?.currentPrice || 0) : (await getUsdPriceForAsset(String(borrowAsset?.network || ''), String(borrowAsset?.symbol || ''))).valueOf() || Number(borrowAsset?.currentPrice || 0);
      const collateralUsd = IS_DEV_ENV ? Number(collateralAssetForPricing?.currentPrice || 0) : (await getUsdPriceForAsset(String(collateralAssetForPricing?.network || ''), String(collateralAssetForPricing?.symbol || ''))).valueOf() || Number(collateralAssetForPricing?.currentPrice || 0);

      const target = Number(loan.targetLtvLoanToCollateral || 0.5);
      const collateralValueUsd = Number(loan.collateralReceivedAmountToken || 0) * (collateralUsd || 0);
      const allowedLoanUsd = collateralValueUsd * target;
      const allowedLoanTokensRaw = (borrowUsd > 0) ? (allowedLoanUsd / borrowUsd) : 0;
      const allowedLoanTokens = Math.max(0, allowedLoanTokensRaw);

      if (allowedLoanTokens > 0) {
        // Cap to quoted loan amount
        const disburseTokens = Math.min(allowedLoanTokens, Number(loan.loanAmount || 0));

        // Adjust loan principal and origination fee to the disbursed amount
        loan.loanAmount = disburseTokens;
        loan.originationFeeAmountToken = disburseTokens * (Number(loan.originationFeePercent || 0) / 100);

        // Activate and disburse
        loan.status = 'ACTIVE';
        loan.disbursedAt = new Date();
        await loan.save();

        const { default: UserBalance } = await import('../models/UserBalance');
        const { default: Transaction } = await import('../models/Transaction');

        if (loan.payoutMethod === 'INTERNAL') {
          await UserBalance.findOneAndUpdate(
            { userId: baseWallet.userId, assetId: borrowAsset?._id },
            { $inc: { balance: disburseTokens } },
            { upsert: true, new: true }
          );
          await Transaction.create({ user: baseWallet.userId, type: 'loan-disbursement', amount: disburseTokens, asset: String(borrowAsset?.symbol || ''), status: 'completed', loanId: loan._id });
        } else {
          if (IS_DEV_ENV) {
            await Transaction.create({ user: baseWallet.userId, type: 'loan-disbursement', amount: disburseTokens, asset: String(borrowAsset?.symbol || ''), status: 'completed', loanId: loan._id });
          } else {
            try {
              const { txHash } = await sendFromLiquidityWallet({ asset: borrowAsset, to: String(loan.payoutAddress || ''), amountToken: disburseTokens });
              await Transaction.create({ user: baseWallet.userId, type: 'loan-disbursement', amount: disburseTokens, asset: String(borrowAsset?.symbol || ''), status: 'completed', loanId: loan._id, txHash });
            } catch (e) {
              console.error('External payout failed:', e);
              await Transaction.create({ user: baseWallet.userId, type: 'loan-disbursement', amount: disburseTokens, asset: String(borrowAsset?.symbol || ''), status: 'failed', loanId: loan._id });
            }
          }
        }
      } else {
        await loan.save();
      }
    }

    return;
  }

  

  // Standard user deposit flow (non-collateral)
  if (assetDoc) {
    await UserBalance.findOneAndUpdate(
      { userId: baseWallet.userId, assetId: assetDoc._id },
      { $inc: { balance: netAmount } },
      { upsert: true, new: true }
    );
  }

  if (assetDoc) {
    assetDoc.amountHeld = (assetDoc.amountHeld || 0) + netAmount;
    await assetDoc.save();
  }

  await Transaction.create({
    user: baseWallet.userId,
    type: 'deposit',
    amount: netAmount,
    asset: assetDoc ? assetDoc.symbol : currency,
    status: 'confirmed',
    txHash: txId,
    network: walletNet,
    contractAddress: isToken ? contractAddress : undefined,
    // audit fields
    grossAmount: amountNum,
    netAmount: netAmount,
    feePercent: receiveFeePercent,
    feeAmount: amountNum - netAmount,
  });

  if (!IS_DEV_ENV) {
    try {
      if (isToken) {
        const kind = internalNet.startsWith('TRON') ? 'trc20' : 'erc20';
        await relocateFundsToLiquidityWallet(String(baseWallet._id), {
          amount: amountNum,
          kind,
          tokenAddress: contractAddress!,
          decimals: assetDoc?.decimals,
        });
      } else {
        await relocateFundsToLiquidityWallet(String(baseWallet._id), amountNum);
      }
    } catch (e) {
      console.error('Relocation failed for tx:', txId, e);
    }
  } else {
    console.log('Development environment detected; skipping fund relocation. User balance already credited.');
  }
});

export const enqueueDepositJob = (payload: TatumIncomingPayload) => depositQueue.enqueue(payload);

