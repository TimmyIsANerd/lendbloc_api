import { z } from 'zod';

export const updateUserProfileSchema = z.object({
  title: z.string().optional(),
  fullName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in DD/MM/YYYY format").optional(),
  phoneNumber: z.string().optional(),
});

export const requestPasswordChangeSchema = z.object({
  email: z.email(),
});

export const validatePasswordChangeOTPSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  otp: z.string().length(6),
})

export const updatePasswordChangeSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  password: z.string().min(8),
})

export const requestEmailChangeSchema = z.object({
  newEmail: z.email(),
});

export const validateEmailChangeOTPSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  otp: z.string().length(6),
});

export const updateEmailChangeSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  newEmail: z.email(),
});

// List user transactions filtered by token asset
export const listUserTransactionsSchema = z
  .object({
    assetSymbol: z.string().min(1, 'assetSymbol is required').optional(),
    contractAddress: z.string().min(1).optional(),
    type: z
      .enum(['deposit', 'withdrawal', 'loan-repayment', 'interest-payment', 'swap', 'relocation'])
      .optional(),
    status: z.enum(['pending', 'completed', 'failed', 'confirmed', 'relocated']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .refine((data) => !!data.assetSymbol || !!data.contractAddress, {
    message: 'Provide assetSymbol or contractAddress',
    path: ['assetSymbol'],
  });
