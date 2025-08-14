import { type Context } from 'hono';
import User from '../../models/User';
import Loan from '../../models/Loan';
import SavingsAccount from '../../models/SavingsAccount';
import Transaction from '../../models/Transaction';

export const getUsers = async (c: Context) => {
  const users = await User.find();
  return c.json(users);
};

export const getLoans = async (c: Context) => {
  const loans = await Loan.find();
  return c.json(loans);
};

export const getSavings = async (c: Context) => {
  const savings = await SavingsAccount.find();
  return c.json(savings);
};

export const getTransactions = async (c: Context) => {
  const transactions = await Transaction.find();
  return c.json(transactions);
};