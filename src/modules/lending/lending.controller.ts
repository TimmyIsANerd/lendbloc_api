import { type Context } from 'hono';
import { z } from 'zod';
import Loan, { LoanStatus } from '../../models/Loan';
import Asset from '../../models/Asset';
import User from '../../models/User';
import UserBalance from '../../models/UserBalance';
import { termKeyFromDays } from '../../helpers/assets/terms';
import { createLoanSchema, repayLoanSchema } from './lending.validation';

export const createLoan = async (c: Context) => {
  // Deprecated direct-loan path retained for backward compat; advise using quote + from-quote flow
  return c.json({ error: 'Deprecated endpoint. Use /api/v1/lending/quotes then /loans/from-quote.' }, 410);
};

export const repayLoan = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const loanId = c.req.param('id');
  const { amount } = c.req.valid('json' as never) as z.infer<
    typeof repayLoanSchema
  >;

  try {
    const loan = await Loan.findOne({ _id: loanId, userId, status: LoanStatus.ACTIVE });

    if (!loan) {
      return c.json({ error: 'Active loan not found' }, 404);
    }

    // Check if repayment amount is valid
    if (amount <= 0 || amount > loan.loanAmount) {
      return c.json({ error: 'Invalid repayment amount' }, 400);
    }

    // Update loan amount
    loan.loanAmount -= amount;

    // If loan is fully repaid, change status to REPAID and return collateral
    if (loan.loanAmount <= 0) {
      loan.status = LoanStatus.REPAID;
      // Unlock collateral back to balance
      await UserBalance.updateOne(
        { userId, assetId: loan.collateralAssetId },
        { $inc: { balance: loan.collateralAmount, locked: -loan.collateralAmount } }
      );
    }

    await loan.save();

    return c.json({ message: 'Loan repaid successfully', loan });
  } catch (error) {
    console.error('Error repaying loan:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};