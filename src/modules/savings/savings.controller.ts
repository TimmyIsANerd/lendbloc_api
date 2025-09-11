import { type Context } from 'hono';
import { z } from 'zod';
import SavingsAccount from '../../models/SavingsAccount';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import User, { AccountType } from '../../models/User';
import { termKeyFromDays } from '../../helpers/assets/terms';
import { createSavingsAccountSchema, depositToSavingsAccountSchema, withdrawFromSavingsAccountSchema } from './savings.validation';

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

    const existingSavingsAccount = await SavingsAccount.findOne({ userId, assetId: asset._id });

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
    });

    return c.json({ message: 'Savings account created successfully', savingsAccount });
  } catch (error) {
    console.error('Error creating savings account:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const depositToSavingsAccount = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const savingsAccountId = c.req.param('id');
  const { amount } = c.req.valid('json' as never) as z.infer<
    typeof depositToSavingsAccountSchema
  >;

  try {
    const savingsAccount = await SavingsAccount.findOne({ _id: savingsAccountId, userId });

    if (!savingsAccount) {
      return c.json({ error: 'Savings account not found' }, 404);
    }

    const UB = (await import('../../models/UserBalance')).default;
    const userBal = await UB.findOne({ userId, assetId: savingsAccount.assetId });

    if (!userBal || userBal.balance < amount) {
      return c.json({ error: 'Insufficient balance' }, 400);
    }

    await UB.updateOne({ userId, assetId: savingsAccount.assetId }, { $inc: { balance: -amount } });

    savingsAccount.balance += amount;
    await savingsAccount.save();

    return c.json({ message: 'Deposit successful', savingsAccount });
  } catch (error) {
    console.error('Error depositing to savings account:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const withdrawFromSavingsAccount = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const savingsAccountId = c.req.param('id');
  const { amount } = c.req.valid('json' as never) as z.infer<
    typeof withdrawFromSavingsAccountSchema
  >;

  try {
    const savingsAccount = await SavingsAccount.findOne({ _id: savingsAccountId, userId });

    if (!savingsAccount) {
      return c.json({ error: 'Savings account not found' }, 404);
    }

    // Enforce locking period
    if (new Date() < new Date(savingsAccount.lockEndAt)) {
      return c.json({ error: 'Savings are locked until the end of the term' }, 403);
    }

    if (savingsAccount.balance < amount) {
      return c.json({ error: 'Insufficient balance in savings account' }, 400);
    }

    const UB = (await import('../../models/UserBalance')).default;
    await UB.findOneAndUpdate(
      { userId, assetId: savingsAccount.assetId },
      { $inc: { balance: amount } },
      { upsert: true }
    );

    savingsAccount.balance -= amount;
    await savingsAccount.save();

    return c.json({ message: 'Withdrawal successful', savingsAccount });
  } catch (error) {
    console.error('Error withdrawing from savings account:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};