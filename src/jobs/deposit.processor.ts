import Wallet from "../models/Wallet";
import Asset from "../models/Asset";
import Transaction from "../models/Transaction";
import { depositQueue, type TatumIncomingPayload } from "./queue";
import { confirmTransaction } from "../helpers/tatum/confirm";
import { mapTatumChainToInternalNetwork, toWalletNetwork } from "../helpers/tatum/mapping";
import { relocateFundsToLiquidityWallet } from "../utils/funds";
import User, { AccountType } from "../models/User";

// Initialize processor

depositQueue.setProcessor(async (payload: TatumIncomingPayload) => {
  const { currency, address, blockNumber, txId, chain, subscriptionType, amount, contractAddress } = payload;
  const amountNum = Number(amount);
  if (!address || !txId || !chain || !subscriptionType || !amountNum) {
    console.warn("Deposit job missing fields, skipping", payload);
    return;
  }

  // Confirm on-chain inclusion
  const confirmed = await confirmTransaction({ txId, chain, blockNumber: Number(blockNumber) });
  if (!confirmed) {
    console.log(`Tx ${txId} not yet confirmed; skipping for now.`);
    return; // In-memory queue: simple drop; webhook resend will re-enqueue
  }

  // Find base wallet by chain address
  const baseWallet = await Wallet.findOne({ address });
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

  let targetWallet = baseWallet;
  let assetDoc = await Asset.findById(baseWallet.assetId);

  const isToken = subscriptionType === 'INCOMING_FUNGIBLE_TX' && !!contractAddress;

  // If token, establish or find Asset and ensure user Wallet exists (no asset auto-create)
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
      });
      return;
    }

    assetDoc = tokenAsset;

    // Ensure a wallet exists tied to this token asset for the same user
    const existingTokenWallet = await Wallet.findOne({ userId: baseWallet.userId, assetId: tokenAsset._id });
    if (!existingTokenWallet) {
      const created = await Wallet.create({
        userId: baseWallet.userId,
        assetId: tokenAsset._id,
        address: baseWallet.address,
        balance: 0,
        encryptedMnemonic: baseWallet.encryptedMnemonic,
        network: walletNet,
        isLiquidityWallet: false,
      });
      targetWallet = created;
    } else {
      targetWallet = existingTokenWallet;
    }
  }

  // Apply receive fee when crediting user wallet by account type
  let receiveFeePercent = 0;
  try {
    const user = await User.findById(baseWallet.userId).select('accountType');
    const acct: AccountType = user?.accountType || AccountType.REG;
    receiveFeePercent = Number(assetDoc?.fees?.receiveFeePercent?.[acct] ?? 0);
  } catch {}
  const netAmount = amountNum * (1 - receiveFeePercent / 100);

  // Credit wallet balance and asset aggregate (net amount)
  targetWallet.balance = (targetWallet.balance || 0) + netAmount;
  await targetWallet.save();

  if (assetDoc) {
    assetDoc.amountHeld = (assetDoc.amountHeld || 0) + netAmount;
    await assetDoc.save();
  }

  // Record the transaction as confirmed with net credited amount
  await Transaction.create({
    user: targetWallet.userId,
    type: 'deposit',
    amount: netAmount,
    asset: assetDoc ? assetDoc.symbol : currency,
    status: 'confirmed',
    txHash: txId,
    network: walletNet,
    contractAddress: isToken ? contractAddress : undefined,
  });

  // Trigger relocation asynchronously (we are already async)
  try {
    if (isToken) {
      const kind = internalNet.startsWith('TRON') ? 'trc20' : 'erc20';
      await relocateFundsToLiquidityWallet(String(targetWallet._id), {
        amount: amountNum,
        kind,
        tokenAddress: contractAddress!,
        decimals: assetDoc?.decimals,
      });
    } else {
      await relocateFundsToLiquidityWallet(String(targetWallet._id), amountNum);
    }
  } catch (e) {
    console.error('Relocation failed for tx:', txId, e);
  }
});

export const enqueueDepositJob = (payload: TatumIncomingPayload) => depositQueue.enqueue(payload);

