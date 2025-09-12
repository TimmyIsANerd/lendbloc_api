import { z } from 'zod';

export const quoteSchema = z.object({
  fromSymbol: z.string().min(1),
  toSymbol: z.string().min(1),
  amount: z.number().positive(),
});

export const swapBySymbolSchema = quoteSchema;

export const priceChangeQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export const voteForCoinSchema = z.object({
  coinName: z.string(),
});
