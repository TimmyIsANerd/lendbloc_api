import { type Context } from 'hono';
import Loan from '../../models/Loan';
import SavingsAccount from '../../models/SavingsAccount';
import Transaction from '../../models/Transaction';
import Wallet from '../../models/Wallet';

export const getDashboard = async (c: Context) => {
  try {
    const { userId } = c.get('jwtPayload');

    const loans = await Loan.find({ userId });
    const savings = await SavingsAccount.find({ userId });
    const transactions = await Transaction.find({ userId });
    const wallet = await Wallet.findOne({ userId });

    const dashboard = {
      loans,
      savings,
      transactions,
      wallet,
    };

    return c.json(dashboard);
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
