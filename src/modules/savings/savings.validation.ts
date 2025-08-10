import { z } from 'zod';

export const createSavingsAccountSchema = z.object({
  assetId: z.string(),
  amount: z.number().positive(),
});

export const depositToSavingsAccountSchema = z.object({
  amount: z.number().positive(),
});

export const withdrawFromSavingsAccountSchema = z.object({
  amount: z.number().positive(),
});