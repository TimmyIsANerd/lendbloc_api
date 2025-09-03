import { z } from 'zod';

export const createSavingsAccountSchema = z.object({
  assetId: z.string(),
  amount: z.number().positive(),
  termDays: z.union([z.literal(7), z.literal(30), z.literal(180), z.literal(365)]),
});

export const depositToSavingsAccountSchema = z.object({
  amount: z.number().positive(),
});

export const withdrawFromSavingsAccountSchema = z.object({
  amount: z.number().positive(),
});