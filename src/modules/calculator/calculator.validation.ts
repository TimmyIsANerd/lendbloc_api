
import { z } from 'zod';

export const calculateProfitSchema = z.object({
  amount: z.number(),
  referrals: z.number(),
});
