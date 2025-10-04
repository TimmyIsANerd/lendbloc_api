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

// List user transactions (filterable by type/status, with optional 'all' type)
export const listUserTransactionsSchema = z.object({
  type: z
    .enum([
      'all',
      'deposit',
      'withdrawal',
      'loan-repayment',
      'interest-payment',
      'interest-accrual',
      'loan-disbursement',
      'liquidation',
      'margin-call',
      'swap',
      'relocation',
    ])
    .optional(),
  status: z.enum(['pending', 'completed', 'failed', 'confirmed', 'relocated']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
