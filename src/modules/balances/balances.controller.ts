import { type Context } from 'hono';
import UserBalance from '../../models/UserBalance';

export const listUserBalances = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  try {
    const items = await UserBalance.find({ userId })
      .populate({ path: 'assetId', select: 'name symbol iconUrl network kind tokenAddress decimals status' })
      .sort({ updatedAt: -1 });
    return c.json({ data: items });
  } catch (error) {
    console.error('Error listing balances:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const getUserBalanceByAsset = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const assetId = c.req.param('id');
  try {
    const bal = await UserBalance.findOne({ userId, assetId })
      .populate({ path: 'assetId', select: 'name symbol iconUrl network kind tokenAddress decimals status' });
    if (!bal) return c.json({ error: 'Balance not found' }, 404);
    return c.json(bal);
  } catch (error) {
    console.error('Error fetching balance:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};
