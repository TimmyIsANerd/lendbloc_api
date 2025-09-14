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

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID'),
});

export const assetParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid asset ID'),
});

export const historyQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const interestAnalyticsQuerySchema = z.object({
  range: z.enum(['6m', '1y', 'all']).default('6m'),
  assetId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});
