import { z } from 'zod';

export const registerUserSchema = z.object({
  title: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in DD/MM/YYYY format"),
  email: z.email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  email: z.email(),
  otp: z.string().length(6),
});

export const verifyPhoneSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  phone: z.string(),
  otp: z.string().length(6).optional(),
});

export const loginUserSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
  password: z.string(),
});

export const verifyOtpSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
  otp: z.string().length(6),
});

export const requestPasswordResetSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const setPasswordSchema = z.object({
  email: z.email().optional(),
  phone: z.string().optional(),
  otp: z.string().length(5),
  password: z.string().min(8),
});
