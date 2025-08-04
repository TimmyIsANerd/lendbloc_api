import { z } from 'zod';

export const swapSchema = z.object({
  fromAssetSymbol: z.string(),
  toAssetSymbol: z.string(),
  amount: z.number().positive(),
});

export const voteCoinSchema = z.object({
  coinSymbol: z.string(),
});
