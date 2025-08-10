import { z } from 'zod';

export const swapCryptoSchema = z.object({
  fromAssetId: z.string(),
  toAssetId: z.string(),
  amount: z.number().positive(),
});

export const voteForCoinSchema = z.object({
  coinName: z.string(),
});