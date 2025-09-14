import { z } from 'zod';

export const quoteLoanSchema = z.object({
  borrowSymbol: z.string().min(1),
  borrowNetwork: z.enum(['ETH','TRON']),
  borrowAmount: z.number().positive(),
  collateralSymbol: z.enum(['ETH','BTC','TRX','LTC','TRON']).transform((v) => v === 'TRON' ? 'TRX' : v),
});

export const createLoanFromQuoteSchema = z.object({
  quoteId: z.string().regex(/^[0-9a-fA-F]{24}$/,'Invalid quote id'),
  payoutMethod: z.enum(['INTERNAL','EXTERNAL']),
  payoutAddress: z.string().optional(),
  simulate: z.boolean().optional(),
});

export const loanIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid loan ID'),
});

export const listLoansQuerySchema = z.object({
  status: z.enum(['PENDING_COLLATERAL','ACTIVE','REPAID','CANCELLED','LIQUIDATED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const increaseCollateralSchema = z.object({
  method: z.enum(['INTERNAL','EXTERNAL']),
  amountToken: z.number().positive().optional(),
  txHash: z.string().optional(),
});

export const repayRequestOtpSchema = z.object({
  method: z.enum(['INTERNAL','EXTERNAL']),
  amountToken: z.number().positive(),
});

export const repayConfirmSchema = z.object({
  method: z.enum(['INTERNAL','EXTERNAL']),
  amountToken: z.number().positive(),
  otpCode: z.string().min(4).max(8).optional(),
  txHash: z.string().optional(),
});

const INTEREST_ALLOWED = [25, 50, 75, 90] as const;
const COLLATERAL_ALLOWED = [-25, -50, -75, -90] as const;

export const updateLoanAlertsSchema = z.object({
  interest: z
    .object({ thresholds: z.array(z.number()).optional() })
    .partial()
    .optional()
    .refine((val) => {
      if (!val?.thresholds) return true;
      return val.thresholds.every((n) => (INTEREST_ALLOWED as readonly number[]).includes(n));
    }, { message: 'Invalid interest thresholds. Allowed: 25,50,75,90' }),
  collateral: z
    .object({ dipping: z.boolean().optional(), thresholds: z.array(z.number()).optional() })
    .partial()
    .optional()
    .refine((val) => {
      if (!val?.thresholds) return true;
      return val.thresholds.every((n) => (COLLATERAL_ALLOWED as readonly number[]).includes(n));
    }, { message: 'Invalid collateral thresholds. Allowed: -25,-50,-75,-90' }),
});

