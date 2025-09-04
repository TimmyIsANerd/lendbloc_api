import { type Context } from 'hono';
import Wallet from '../../models/Wallet';
import Asset from '../../models/Asset';

export const getUserWallets = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;

  try {
    const wallets = await Wallet.find({ userId }).select('-encryptedMnemonic').populate('assetId');
    return c.json(wallets);
  } catch (error) {
    console.error('Error fetching user wallets:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getWalletDetails = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const walletId = c.req.param('id');

  // Validate ID, make sure string length matches needed input for mongoose
  if (walletId.length !== 24) {
    return c.json({ error: 'Invalid wallet ID' }, 400);
  }

  try {
    const wallet = await Wallet.findOne({ _id: walletId, userId }).select('-encryptedMnemonic').populate('assetId');

    if (!wallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }

    return c.json(wallet);
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getWalletByAddress = async (c: Context) => {
  const walletAddress = c.req.param('walletAddress');

  try {
    const wallet = await Wallet.findOne({ address: walletAddress }).select('-encryptedMnemonic').populate('assetId');

    if (!wallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }

    return c.json(wallet);
  } catch (error) {
    console.error('Error fetching wallet by address:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
}

export const createWallet = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { assetSymbol } = await c.req.json();

  try {
    const asset = await Asset.findOne({ symbol: assetSymbol });

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404);
    }

    const existingWallet = await Wallet.findOne({ userId, assetId: asset._id });

    if (existingWallet) {
      return c.json({ error: 'Wallet for this asset already exists' }, 409);
    }

    const wallet = await Wallet.create({
      userId,
      assetId: asset._id,
      address: `${assetSymbol.toLowerCase()}_address_${userId}`,
      balance: 0,
    });

    const { encryptedMnemonic, ...walletResponse } = wallet.toObject();

    return c.json({ message: 'Wallet created successfully', wallet: walletResponse });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
