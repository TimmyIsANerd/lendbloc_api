import { type Context } from 'hono';
import { z } from 'zod';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import { swapSchema, voteCoinSchema } from './exchange.validation';

export const swapCrypto = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { fromAssetSymbol, toAssetSymbol, amount } = c.req.valid('json' as never) as z.infer<
    typeof swapSchema
  >;

  try {
    const fromAsset = await Asset.findOne({ symbol: fromAssetSymbol });
    const toAsset = await Asset.findOne({ symbol: toAssetSymbol });

    if (!fromAsset || !toAsset) {
      return c.json({ error: 'Invalid asset symbol' }, 400);
    }

    const fromWallet = await Wallet.findOne({ userId, assetId: fromAsset._id });

    if (!fromWallet || fromWallet.balance < amount) {
      return c.json({ error: 'Insufficient balance in source wallet' }, 400);
    }

    // Simulate exchange rate (for simplicity, assume 1:1 for now)
    const convertedAmount = amount * (fromAsset.currentPrice / toAsset.currentPrice);

    // Deduct from source wallet
    fromWallet.balance -= amount;
    await fromWallet.save();

    // Add to destination wallet (create if not exists)
    let toWallet = await Wallet.findOne({ userId, assetId: toAsset._id });
    if (!toWallet) {
      toWallet = await Wallet.create({
        userId,
        assetId: toAsset._id,
        address: `${toAssetSymbol.toLowerCase()}_address_${userId}`, // Placeholder
        balance: convertedAmount,
      });
    } else {
      toWallet.balance += convertedAmount;
      await toWallet.save();
    }

    return c.json({ message: 'Swap successful', fromAsset, toAsset, amount, convertedAmount });
  } catch (error) {
    console.error('Error during crypto swap:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const voteForCoin = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { coinSymbol } = c.req.valid('json' as never) as z.infer<
    typeof voteCoinSchema
  >;

  try {
    // In a real application, this would involve a more complex voting mechanism
    // For now, we'll just log the vote and return a success message.
    console.log(`User ${userId} voted for ${coinSymbol}`);

    return c.json({ message: `Vote for ${coinSymbol} recorded successfully` });
  } catch (error) {
    console.error('Error during coin voting:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
