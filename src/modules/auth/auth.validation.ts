import { z } from 'zod';

// OTP-first auth
export const otpStartSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format').optional(),
  referrer: z.string().optional(),
}).refine((data) => !!data.email || !!data.phone, {
  message: 'Either email or phone is required',
});

export const otpVerifySchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  otp: z.string().length(6),
  clientDevice: z.enum(['web', 'mobile']),
});

// KYC Bio (Flow 1)
export const kycBioSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  title: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Date of birth must be in DD/MM/YYYY format'),
  email: z.string().email(),
  socialIssuanceNumber: z.string().min(4),
  password: z.string().min(8),
});

// Existing verification flows kept
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

export const kycDocumentSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const kycFaceSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const kycAddressSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  fullAddress: z.string().min(10),
});

export const kycConsentSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  text: z.string().optional(),
});

export const submitKycSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email().optional(),
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

export const getKycStatusSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});
