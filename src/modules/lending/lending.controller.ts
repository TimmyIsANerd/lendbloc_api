import { type Context } from 'hono';
import { z } from 'zod';
import Loan, { LoanStatus } from '../../models/Loan';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import { createLoanSchema, repayLoanSchema } from './lending.validation';

export const createLoan = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { collateralAssetSymbol, collateralAmount, loanAssetSymbol, loanAmount, interestRate } = c.req.valid('json' as never) as z.infer<
    typeof createLoanSchema
  >;

  try {
    const collateralAsset = await Asset.findOne({ symbol: collateralAssetSymbol });
    const loanAsset = await Asset.findOne({ symbol: loanAssetSymbol });

    if (!collateralAsset || !loanAsset) {
      return c.json({ error: 'Invalid asset symbol' }, 400);
    }

    // Check if user has enough collateral in their wallet
    const userCollateralWallet = await Wallet.findOne({ userId, assetId: collateralAsset._id });

    if (!userCollateralWallet || userCollateralWallet.balance < collateralAmount) {
      return c.json({ error: 'Insufficient collateral in wallet' }, 400);
    }

    // Calculate LTV (Loan-to-Value)
    const ltv = (loanAmount / collateralAmount) * (loanAsset.currentPrice / collateralAsset.currentPrice);

    // Create the loan
    const loan = await Loan.create({
      userId,
      collateralAssetId: collateralAsset._id,
      collateralAmount,
      loanAssetId: loanAsset._id,
      loanAmount,
      ltv,
      interestRate,
      status: LoanStatus.ACTIVE,
    });

    // Deduct collateral from user's wallet (simulate locking collateral)
    userCollateralWallet.balance -= collateralAmount;
    await userCollateralWallet.save();

    return c.json({ message: 'Loan created successfully', loan });
  } catch (error) {
    console.error('Error creating loan:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
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
      const userCollateralWallet = await Wallet.findOne({ userId, assetId: loan.collateralAssetId });
      if (userCollateralWallet) {
        userCollateralWallet.balance += loan.collateralAmount;
        await userCollateralWallet.save();
      }
    }

    await loan.save();

    return c.json({ message: 'Loan repaid successfully', loan });
  } catch (error) {
    console.error('Error repaying loan:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
