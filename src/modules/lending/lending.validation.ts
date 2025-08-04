import { z } from 'zod';

export const createLoanSchema = z.object({
  collateralAssetSymbol: z.string(),
  collateralAmount: z.number().positive(),
  loanAssetSymbol: z.string(),
  loanAmount: z.number().positive(),
  interestRate: z.number().positive(),
});

export const repayLoanSchema = z.object({
  amount: z.number().positive(),
});
