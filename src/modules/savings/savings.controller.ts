import { type Context } from 'hono';
import { z } from 'zod';
import SavingsAccount from '../../models/SavingsAccount';
import SavingsEarning from '../../models/SavingsEarning';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import User, { AccountType } from '../../models/User';
import { termKeyFromDays } from '../../helpers/assets/terms';
import { getUsdPriceForAsset } from '../../helpers/tatum/rates';
import {
  createSavingsAccountSchema,
  depositToSavingsAccountSchema,
  withdrawFromSavingsAccountSchema,
  idParamSchema,
  assetParamSchema,
  historyQuerySchema,
} from './savings.validation';

export const createSavingsAccount = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { assetId, amount, termDays } = c.req.valid('json' as never) as z.infer<
    typeof createSavingsAccountSchema
  >;

  try {
    const asset = await Asset.findById(assetId);

    if (!asset) {
      return c.json({ error: 'Asset not found' }, 400);
    }

    if (asset.status !== 'LISTED') {
      return c.json({ error: 'Asset is not available for savings' }, 400);
    }

    const existingSavingsAccount = await SavingsAccount.findOne({ userId, assetId: asset._id, status: 'ACTIVE' });

    if (existingSavingsAccount) {
      return c.json({ error: 'Savings account for this asset already exists' }, 409);
    }

    const userBalance = await (await import('../../models/UserBalance')).default.findOne({ userId, assetId: asset._id });

    if (!userBalance || userBalance.balance < amount) {
      return c.json({ error: 'Insufficient balance' }, 400);
    }

    await (await import('../../models/UserBalance')).default.updateOne(
      { userId, assetId: asset._id },
      { $inc: { balance: -amount } }
    );

    const user = await User.findById(userId).select('accountType');
    const acct: AccountType = user?.accountType || AccountType.REG;

    const tKey = termKeyFromDays(termDays as 7 | 30 | 180 | 365);
    const apy = asset.fees?.savingsInterest?.[acct]?.[tKey] ?? 0;
    const lockStartAt = new Date();
    const lockEndAt = new Date(lockStartAt.getTime() + termDays * 24 * 60 * 60 * 1000);

    const savingsAccount = await SavingsAccount.create({
      userId,
      assetId: asset._id,
      balance: amount,
      apy, // percent
      termDays,
      lockStartAt,
      lockEndAt,
      lastPayoutAt: lockStartAt,
      status: 'ACTIVE',
    });

    return c.json({ message: 'Savings account created successfully', savingsAccount });
  } catch (error) {
    console.error('Error creating savings account:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

// Deposits disabled per new spec (save or unsave only)
export const depositToSavingsAccount = async (c: Context) => {
  return c.json({ error: 'Deposits are disabled. Create a new savings or use unsave at maturity.' }, 400);
};

// Withdrawals disabled per new spec (unsave only)
export const withdrawFromSavingsAccount = async (c: Context) => {
  return c.json({ error: 'Withdrawals are disabled. Use unsave after the end of the term.' }, 403);
};

export const unsaveSavingsAccount = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof idParamSchema>;

  try {
    let savingsAccount = await SavingsAccount.findOne({ _id: id, userId });
    if (!savingsAccount) {
      return c.json({ error: 'Savings account not found' }, 404);
    }

    // Normalize/backfill status for legacy records and guard closed accounts
    if ((savingsAccount as any).status === 'CLOSED') {
      return c.json({ error: 'Savings account already closed' }, 409);
    }
    if (!(savingsAccount as any).status) {
      (savingsAccount as any).status = 'ACTIVE';
      if (!(savingsAccount as any).lastPayoutAt) {
        (savingsAccount as any).lastPayoutAt = (savingsAccount as any).lockStartAt || (savingsAccount as any).createdAt || new Date();
      }
      await savingsAccount.save();
    }

    // Early unsave allowed: credit principal + any already-accrued monthly payouts (no partial-month interest)
    const UB = (await import('../../models/UserBalance')).default;

    const creditedAmount = savingsAccount.balance;

    await UB.findOneAndUpdate(
      { userId, assetId: savingsAccount.assetId },
      { $inc: { balance: creditedAmount } },
      { upsert: true, new: true }
    );

    savingsAccount.status = 'CLOSED' as any;
    savingsAccount.closedAt = new Date();
    await savingsAccount.save();

    return c.json({ message: 'Savings account closed successfully', creditedAmount, savingsAccount: { _id: savingsAccount._id, status: savingsAccount.status, closedAt: savingsAccount.closedAt } });
  } catch (error) {
    console.error('Error closing savings account:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getSavingsByAsset = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id: assetId } = c.req.valid('param' as never) as z.infer<typeof assetParamSchema>;

  try {
    // Prefer an explicitly ACTIVE record if present
    let sa = await SavingsAccount.findOne({ userId, assetId, status: 'ACTIVE' });
    if (sa) return c.json(sa);

    // Fallback: latest record for this asset (legacy or missing status)
    sa = await SavingsAccount.findOne({ userId, assetId }).sort({ createdAt: -1 });
    if (!sa) return c.json({ error: 'Savings for this asset not found' }, 404);

    // If CLOSED, no active savings exists
    if ((sa as any).status === 'CLOSED') return c.json({ error: 'Active savings for this asset not found' }, 404);

    // Legacy backfill: if missing status, treat as ACTIVE and persist
    if (!(sa as any).status) {
      (sa as any).status = 'ACTIVE';
      if (!(sa as any).lastPayoutAt) (sa as any).lastPayoutAt = (sa as any).lockStartAt || (sa as any).createdAt || new Date();
      await sa.save();
    }

    return c.json(sa);
  } catch (error) {
    console.error('Error fetching savings account by asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const listSavings = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  try {
    const items = await SavingsAccount.find({ userId }).sort({ createdAt: -1 });
    return c.json({ data: items });
  } catch (error) {
    console.error('Error listing savings accounts:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const getSavingsHistory = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id: assetId } = c.req.valid('param' as never) as z.infer<typeof assetParamSchema>;
  const { from, to, page, limit } = c.req.valid('query' as never) as z.infer<typeof historyQuerySchema>;

  try {
    const asset = await Asset.findById(assetId).select('symbol network status');
    if (!asset || asset.status !== 'LISTED') {
      return c.json({ error: 'Asset not found or not listed' }, 404);
    }

    const pageNum = page ?? 1;
    const limitNum = limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const filter: any = { userId, assetId };
    if (Object.keys(dateFilter).length > 0) filter.accruedAt = dateFilter;

    const [items, total] = await Promise.all([
      SavingsEarning.find(filter).sort({ accruedAt: -1 }).skip(skip).limit(limitNum),
      SavingsEarning.countDocuments(filter),
    ]);

    // Fetch USD price once via Tatum and multiply
    const usdPrice = await getUsdPriceForAsset(asset.network, asset.symbol);

    const data = items.map((e) => ({
      _id: e._id,
      userId: e.userId,
      assetId: e.assetId,
      savingsAccountId: e.savingsAccountId,
      amount: e.amount,
      usdAmount: Number(((e.amount || 0) * (usdPrice || 0)).toFixed(8)),
      apy: e.apy,
      termDays: e.termDays,
      accruedAt: e.accruedAt,
      createdAt: (e as any).createdAt,
      updatedAt: (e as any).updatedAt,
    }));

    return c.json({
      data,
      meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    console.error('Error fetching savings history:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};
