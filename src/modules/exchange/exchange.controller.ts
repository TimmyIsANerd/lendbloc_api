import { type Context } from 'hono';
import { z } from 'zod';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import Vote from '../../models/Vote';
import User, { AccountType } from '../../models/User';
import { swapCryptoSchema, voteForCoinSchema } from './exchange.validation';

export const swapCrypto = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { fromAssetId, toAssetId, amount } = c.req.valid('json' as never) as z.infer<
    typeof swapCryptoSchema
  >;

  try {
    const fromAsset = await Asset.findById(fromAssetId);
    const toAsset = await Asset.findById(toAssetId);

    const user = await User.findById(userId).select('accountType');
    const acct: AccountType = user?.accountType || AccountType.REG;

    if (!fromAsset || !toAsset) {
      return c.json({ error: 'Invalid asset ID' }, 400);
    }

    if (fromAsset.status !== 'LISTED' || toAsset.status !== 'LISTED') {
      return c.json({ error: 'Selected assets are not available for exchange' }, 400);
    }

    const fromWallet = await Wallet.findOne({ userId, assetId: fromAsset._id });

    if (!fromWallet || fromWallet.balance < amount) {
      return c.json({ error: 'Insufficient balance in source wallet' }, 400);
    }

    // Simulate exchange rate by price ratio
    const convertedAmount = amount * (fromAsset.currentPrice / toAsset.currentPrice);

    // Apply exchange fees: from side and to side by account type
    const fromFeePercent = Number(fromAsset.fees?.exchangeFeePercentFrom?.[acct] ?? 0);
    const toFeePercent = Number(toAsset.fees?.exchangeFeePercentTo?.[acct] ?? 0);

    const fromFeeAmount = amount * (fromFeePercent / 100);
    const toFeeAmount = convertedAmount * (toFeePercent / 100);
    const netReceived = convertedAmount - toFeeAmount;

    // Ensure source wallet has enough for amount + from fee
    const totalDebit = amount + fromFeeAmount;
    if (fromWallet.balance < totalDebit) {
      return c.json({ error: 'Insufficient balance in source wallet to cover amount and fee' }, 400);
    }

    // Deduct from source wallet: amount + fee
    fromWallet.balance -= totalDebit;
    await fromWallet.save();

    // Add to destination wallet (create if not exists)
    let toWallet = await Wallet.findOne({ userId, assetId: toAsset._id });
    if (!toWallet) {
      toWallet = await Wallet.create({
        userId,
        assetId: toAsset._id,
        address: `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        balance: netReceived,
        network: toAsset.network,
        encryptedMnemonic: fromWallet.encryptedMnemonic, // This is not secure, just for demonstration
      });
    } else {
      toWallet.balance += netReceived;
      await toWallet.save();
    }

    return c.json({ message: 'Swap successful', fromAsset, toAsset, amount, convertedAmount, fromFeePercent, toFeePercent, fromFeeAmount, toFeeAmount, netReceived });
  } catch (error) {
    console.error('Error during crypto swap:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const voteForCoin = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { coinName } = c.req.valid('json' as never) as z.infer<
    typeof voteForCoinSchema
  >;

  try {
    await Vote.create({ userId, coinName });

    return c.json({ message: `Vote for ${coinName} recorded successfully` });
  } catch (error) {
    console.error('Error during coin voting:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};