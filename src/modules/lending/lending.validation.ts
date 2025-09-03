import { z } from 'zod';

export const createLoanSchema = z.object({
  assetId: z.string(),
  amount: z.number().positive(),
  collateralAssetId: z.string(),
  collateralAmount: z.number().positive(),
  termDays: z.union([z.literal(7), z.literal(30), z.literal(180), z.literal(365)]),
});

export const repayLoanSchema = z.object({
  amount: z.number().positive(),
});