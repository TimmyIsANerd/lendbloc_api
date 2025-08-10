import { z } from 'zod';

export const createLoanSchema = z.object({
  assetId: z.string(),
  amount: z.number().positive(),
  collateralAssetId: z.string(),
  collateralAmount: z.number().positive(),
});

export const repayLoanSchema = z.object({
  amount: z.number().positive(),
});