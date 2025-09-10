import { type Context } from 'hono';
import { z } from 'zod';
import Asset from '../../models/Asset';
import Vote from '../../models/Vote';
import User, { AccountType } from '../../models/User';
import UserBalance from '../../models/UserBalance';
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

    // Use user balances instead of asset-specific wallets
    const fromBal = await UserBalance.findOne({ userId, assetId: fromAsset._id });
    if (!fromBal || fromBal.balance < amount) {
      return c.json({ error: 'Insufficient balance in source asset' }, 400);
    }

    // Simulate exchange rate by price ratio
    const convertedAmount = amount * (fromAsset.currentPrice / toAsset.currentPrice);

    // Apply exchange fees: from side and to side by account type
    const fromFeePercent = Number(fromAsset.fees?.exchangeFeePercentFrom?.[acct] ?? 0);
    const toFeePercent = Number(toAsset.fees?.exchangeFeePercentTo?.[acct] ?? 0);

    const fromFeeAmount = amount * (fromFeePercent / 100);
    const toFeeAmount = convertedAmount * (toFeePercent / 100);
    const netReceived = convertedAmount - toFeeAmount;

    // Ensure source has enough for amount + from fee
    const totalDebit = amount + fromFeeAmount;
    if (fromBal.balance < totalDebit) {
      return c.json({ error: 'Insufficient balance in source asset to cover amount and fee' }, 400);
    }

    // Deduct from source balance and credit destination balance
    await UserBalance.updateOne(
      { userId, assetId: fromAsset._id },
      { $inc: { balance: -totalDebit } }
    );

    const toBal = await UserBalance.findOneAndUpdate(
      { userId, assetId: toAsset._id },
      { $inc: { balance: netReceived } },
      { upsert: true, new: true }
    );

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