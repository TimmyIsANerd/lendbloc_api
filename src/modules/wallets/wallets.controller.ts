import { type Context } from 'hono';
import Wallet from '../../models/Wallet';
import Asset from '../../models/Asset';
import Transaction from '../../models/Transaction';
import { validateAddressForNetwork } from './wallets.validation';

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
      network: asset.network,
      encryptedMnemonic: 'placeholder_encrypted_mnemonic', // In production, this would be properly generated
    });

    const { encryptedMnemonic, ...walletResponse } = wallet.toObject();

    return c.json({ message: 'Wallet created successfully', wallet: walletResponse });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const withdrawFunds = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { assetSymbol, amount, toAddress } = await c.req.json();

  try {
    // Find the asset
    const asset = await Asset.findOne({ symbol: assetSymbol, status: 'LISTED' });
    if (!asset) {
      return c.json({ error: 'Asset not found or not available for withdrawal', code: 'ASSET_NOT_FOUND' }, 404);
    }

    // Validate destination address format based on network
    if (!validateAddressForNetwork(toAddress, asset.network)) {
      return c.json({ 
        error: `Invalid ${asset.network} address format`, 
        code: 'INVALID_ADDRESS_FORMAT' 
      }, 400);
    }

    // Find user's wallet for this asset
    const wallet = await Wallet.findOne({ userId, assetId: asset._id });
    if (!wallet) {
      return c.json({ error: 'Wallet not found for this asset', code: 'WALLET_NOT_FOUND' }, 404);
    }

    // Check if wallet has sufficient balance
    if (wallet.balance < amount) {
      return c.json({ 
        error: 'Insufficient balance', 
        code: 'INSUFFICIENT_BALANCE',
        available: wallet.balance,
        requested: amount
      }, 400);
    }

    // Calculate fees (using sendFeePercent from asset)
    const userTier = 'REG'; // Default tier, could be dynamic based on user status
    const feePercent = asset.fees.sendFeePercent[userTier] || 0;
    const feeAmount = (amount * feePercent) / 100;
    const netAmount = amount - feeAmount;

    // Check if net amount is positive after fees
    if (netAmount <= 0) {
      return c.json({ 
        error: 'Amount too small after fees', 
        code: 'AMOUNT_TOO_SMALL',
        feeAmount,
        netAmount
      }, 400);
    }

    // Create transaction record
    const transaction = await Transaction.create({
      user: userId,
      type: 'withdrawal',
      amount: netAmount,
      asset: assetSymbol,
      status: 'pending',
      network: asset.network,
      grossAmount: amount,
      netAmount,
      feePercent,
      feeAmount,
      contractAddress: asset.tokenAddress || undefined,
    });

    // In development environment, fake the transaction
    const isDevelopment = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';
    
    if (isDevelopment) {
      // Simulate successful transaction
      transaction.status = 'completed';
      transaction.txHash = `fake_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await transaction.save();

      // Update wallet balance
      wallet.balance -= amount;
      await wallet.save();

      return c.json({
        message: 'Withdrawal completed successfully (simulated)',
        transaction: {
          id: transaction._id,
          txHash: transaction.txHash,
          amount: netAmount,
          feeAmount,
          status: transaction.status,
          network: asset.network,
          toAddress
        }
      });
    } else {
      // In production, this would integrate with actual blockchain services
      // For now, we'll return pending status
      return c.json({
        message: 'Withdrawal initiated successfully',
        transaction: {
          id: transaction._id,
          amount: netAmount,
          feeAmount,
          status: transaction.status,
          network: asset.network,
          toAddress
        }
      });
    }

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return c.json({ error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' }, 500);
  }
};
