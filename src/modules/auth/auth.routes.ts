import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import { authMiddleware } from '../../middleware/auth';
import {
  otpStartSchema,
  otpVerifySchema,
  kycBioSchema,
  verifyEmailSchema,
  requestPhoneOtpSchema,
  verifyPhoneSchema,
  kycDocumentSchema,
  kycFaceSchema,
  kycAddressSchema,
  kycConsentSchema,
  submitKycSchema,
  getKycStatusSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  editPhoneNumberSchema,
  validatePasswordResetOTPSchema,
} from './auth.validation';
import {
  otpStart,
  otpVerify,
  kycBio,
  verifyEmail,
  sendPhone,
  verifyPhone,
  kycDocument,
  kycFace,
  kycAddress,
  kycConsent,
  submitKyc,
  getKycStatus,
  requestPasswordReset,
  setPassword,
  refreshToken,
  logout,
  editPhoneNumber,
  validatePasswordResetOTP
} from './auth.controller';

const auth = new Hono();

const phoneLimiter = rateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  limit: 3,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => {
    const { userId } = c.req.valid('json' as never) as z.infer<
      typeof requestPhoneOtpSchema
    >;
    return userId
  },
});

const passwordRequestLimiter = rateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  limit: 1,
  standardHeaders: 'draft-6',
  keyGenerator: (c) => {
    const { email, phone } = c.req.valid('json' as never) as z.infer<
      typeof requestPasswordResetSchema
    >;

    // Use the provided email or phone as the rate limit key
    return email || phone || 'invalid-request';
  },
});

// OTP-only Auth
auth.post('/otp/start', zValidator('json', otpStartSchema), otpStart);
auth.post('/otp/verify', zValidator('json', otpVerifySchema), otpVerify);

// KYC Bio (Flow 1)
auth.post('/kyc/bio', zValidator('json', kycBioSchema), kycBio);

// Email & Phone Verification
auth.post("/verify/email", zValidator('json', verifyEmailSchema), verifyEmail);
auth.post("/send/phone", zValidator('json', requestPhoneOtpSchema), phoneLimiter, sendPhone);
auth.post("/verify/phone", zValidator('json', verifyPhoneSchema), verifyPhone);
auth.post('/edit-phone', zValidator('json', editPhoneNumberSchema), editPhoneNumber)

// KYC
auth.post('/kyc/document', zValidator('form', kycDocumentSchema), kycDocument);
auth.post('/kyc/face', zValidator('form', kycFaceSchema), kycFace);
auth.post('/kyc/address', zValidator('json', kycAddressSchema), kycAddress);
auth.post('/kyc/consent', zValidator('form', kycConsentSchema), kycConsent);
auth.post('/kyc/submit', zValidator('json', submitKycSchema), submitKyc);
auth.get('/kyc/status', zValidator('query', getKycStatusSchema), getKycStatus);

// Password Reset
auth.post(
  '/request-password-reset',
  zValidator('json', requestPasswordResetSchema),
  passwordRequestLimiter,
  requestPasswordReset
);
auth.post(
  '/validate-password-reset-otp',
  zValidator('json', validatePasswordResetOTPSchema),
  validatePasswordResetOTP
);
auth.post('/set-password', zValidator('json', setPasswordSchema), setPassword);

// Token Management
auth.post('/refresh-token', zValidator('json', refreshTokenSchema), refreshToken);

// Logout
auth.post('/logout', authMiddleware, zValidator('json', logoutSchema), logout);

export default auth;
