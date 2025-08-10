import { type Context } from 'hono';
import { z } from 'zod';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import Vote from '../../models/Vote';
import { swapCryptoSchema, voteForCoinSchema } from './exchange.validation';

export const swapCrypto = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { fromAssetId, toAssetId, amount } = c.req.valid('json' as never) as z.infer<
    typeof swapCryptoSchema
  >;

  try {
    const fromAsset = await Asset.findById(fromAssetId);
    const toAsset = await Asset.findById(toAssetId);

    if (!fromAsset || !toAsset) {
      return c.json({ error: 'Invalid asset ID' }, 400);
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
        address: `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        balance: convertedAmount,
        network: toAsset.network,
        encryptedMnemonic: fromWallet.encryptedMnemonic, // This is not secure, just for demonstration
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