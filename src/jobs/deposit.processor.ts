import Wallet from "../models/Wallet";
import Asset from "../models/Asset";
import Transaction from "../models/Transaction";
import UserBalance from "../models/UserBalance";
import { depositQueue, type TatumIncomingPayload } from "./queue";
import { confirmTransaction } from "../helpers/tatum/confirm";
import { mapTatumChainToInternalNetwork, toWalletNetwork } from "../helpers/tatum/mapping";
import { relocateFundsToLiquidityWallet } from "../utils/funds";

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

  // Credit user balance for the resolved asset
  if (assetDoc) {
    await UserBalance.findOneAndUpdate(
      { userId: baseWallet.userId, assetId: assetDoc._id },
      { $inc: { balance: netAmount } },
      { upsert: true, new: true }
    );
  }

  // Update asset aggregate (net amount)
  if (assetDoc) {
    assetDoc.amountHeld = (assetDoc.amountHeld || 0) + netAmount;
    await assetDoc.save();
  }

  // Record the transaction as confirmed with net credited amount
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

  // Trigger relocation asynchronously (we are already async) from base wallet
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

