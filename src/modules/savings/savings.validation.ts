import { z } from 'zod';

export const createSavingsAccountSchema = z.object({
  assetSymbol: z.string(),
  apy: z.number().positive(),
});

export const depositWithdrawSchema = z.object({
  amount: z.number().positive(),
});
