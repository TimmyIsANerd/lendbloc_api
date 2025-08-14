import { z } from 'zod';

export const registerUserSchema = z.object({
  title: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in DD/MM/YYYY format"),
  email: z.email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  referrer: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  otp: z.string().length(6),
});

export const requestPhoneOtpSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const verifyPhoneSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  otp: z.string().length(6),
});

export const initializeKYCSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
})

export const confirmKYCStatusSchema = z.object({
  clientDevice: z.enum(['web', 'mobile']),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
})

export const loginUserSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  password: z.string(),
});

export const verifyOtpSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
  otp: z.string().length(6),
  clientDevice: z.enum(['web', 'mobile']),
});

export const requestPasswordResetSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const editPhoneNumberSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format'),
})

export const validatePasswordResetOTPSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  otp: z.string().length(5),
})

export const setPasswordSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  password: z.string().min(8),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
  clientDevice: z.enum(['web', 'mobile']),
});

export const logoutSchema = z.object({
  clientDevice: z.enum(['web', 'mobile']),
});
