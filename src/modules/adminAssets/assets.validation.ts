import { z } from 'zod';

export const termInterestSchema = z.object({
  d7: z.number().min(0),
  d30: z.number().min(0),
  d180: z.number().min(0),
  d365: z.number().min(0),
});

export const loanInterestSchema = z.object({
  REG: termInterestSchema,
  PRO: termInterestSchema,
});

const perAccountPercentSchema = z.object({ REG: z.number().min(0), PRO: z.number().min(0) })
const perAccountTermInterestSchema = z.object({ REG: termInterestSchema, PRO: termInterestSchema })

export const assetFeesSchema = z.object({
  loanInterest: loanInterestSchema,
  savingsInterest: perAccountTermInterestSchema,
  sendFeePercent: perAccountPercentSchema,
  receiveFeePercent: perAccountPercentSchema,
  exchangeFeePercentFrom: perAccountPercentSchema,
  exchangeFeePercentTo: perAccountPercentSchema,
  referralFeePercent: perAccountPercentSchema,
});

// Partial schemas for fees-only update
const termInterestPartialSchema = z.object({ d7: z.number().min(0).optional(), d30: z.number().min(0).optional(), d180: z.number().min(0).optional(), d365: z.number().min(0).optional() })
const perAccountTermInterestPartialSchema = z.object({ REG: termInterestPartialSchema.optional(), PRO: termInterestPartialSchema.optional() })
const perAccountPercentPartialSchema = z.object({ REG: z.number().min(0).optional(), PRO: z.number().min(0).optional() })

export const updateAssetFeesOnlySchema = z.object({
  loanInterest: perAccountTermInterestPartialSchema.optional(),
  savingsInterest: perAccountTermInterestPartialSchema.optional(),
  sendFeePercent: perAccountPercentPartialSchema.optional(),
  receiveFeePercent: perAccountPercentPartialSchema.optional(),
  exchangeFeePercentFrom: perAccountPercentPartialSchema.optional(),
  exchangeFeePercentTo: perAccountPercentPartialSchema.optional(),
  referralFeePercent: perAccountPercentPartialSchema.optional(),
});

// Path param validation for :id
export const assetIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid asset ID')
});

// Optional body schema if an endpoint needs assetId in the payload
export const assetIdBodySchema = z.object({
  assetId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid asset ID')
});

export const createAssetSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  iconUrl: z.string().url(),
  currentPrice: z.number().min(0),
  marketCap: z.number().min(0),
  circulatingSupply: z.number().min(0),
  amountHeld: z.number().min(0).default(0),
  isLendable: z.boolean().optional().default(true),
  isCollateral: z.boolean().optional().default(true),
  network: z.enum(['ETH','BSC','TRON','BTC','LTC']),
  kind: z.enum(['native','erc20','trc20']).default('native'),
  tokenAddress: z.string().optional(),
  decimals: z.number().optional(),
  status: z.enum(['LISTED','PENDING_VOTES','DELISTED']).optional().default('LISTED'),
  fees: assetFeesSchema,
}).refine((data) => {
  if (data.kind === 'native') return !data.tokenAddress && !data.decimals;
  return !!data.tokenAddress;
}, {
  message: 'tokenAddress is required for token assets; do not provide tokenAddress/decimals for native assets',
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  symbol: z.string().min(1).optional(),
  iconUrl: z.string().url().optional(),
  currentPrice: z.number().min(0).optional(),
  marketCap: z.number().min(0).optional(),
  circulatingSupply: z.number().min(0).optional(),
  amountHeld: z.number().min(0).optional(),
  isLendable: z.boolean().optional(),
  isCollateral: z.boolean().optional(),
  network: z.enum(['ETH','BSC','TRON','BTC','LTC']).optional(),
  kind: z.enum(['native','erc20','trc20']).optional(),
  tokenAddress: z.string().optional(),
  decimals: z.number().optional(),
  status: z.enum(['LISTED','PENDING_VOTES','DELISTED']).optional(),
  fees: assetFeesSchema.optional(),
});

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['LISTED','PENDING_VOTES','DELISTED']).optional(),
  network: z.enum(['ETH','BSC','TRON','BTC','LTC']).optional(),
  kind: z.enum(['native','erc20','trc20']).optional(),
  symbol: z.string().optional(),
});

