import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import { authMiddleware } from '../../middleware/auth';
import {
  registerUserSchema,
  verifyEmailSchema,
  requestPhoneOtpSchema,
  verifyPhoneSchema,
  loginUserSchema,
  verifyOtpSchema,
  kycDocumentSchema,
  kycFaceSchema,
  kycAddressSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
  editPhoneNumberSchema,
  validatePasswordResetOTPSchema,
} from './auth.validation';
import {
  registerUser,
  verifyEmail,
  sendPhone,
  verifyPhone,
  kycDocument,
  kycFace,
  kycAddress,
  loginUser,
  verifyLogin,
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
  limit: 1,
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


auth.post('/register', zValidator('json', registerUserSchema), registerUser);
auth.post("/verify/email", zValidator('json', verifyEmailSchema), verifyEmail);
auth.post("/send/phone", zValidator('json', requestPhoneOtpSchema), phoneLimiter, sendPhone);
auth.post("/verify/phone", zValidator('json', verifyPhoneSchema), verifyPhone);
auth.post('/kyc/document', zValidator('form', kycDocumentSchema), kycDocument);
auth.post('/kyc/face', zValidator('form', kycFaceSchema), kycFace);
auth.post('/kyc/address', zValidator('form', kycAddressSchema), kycAddress);
auth.post('/login', zValidator('json', loginUserSchema), loginUser);
auth.post('/verify-login', zValidator('json', verifyOtpSchema), verifyLogin);
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
auth.post(
  '/edit-phone',
  zValidator('json', editPhoneNumberSchema),
  editPhoneNumber
)
auth.post('/set-password', zValidator('json', setPasswordSchema), setPassword);
auth.post('/refresh-token', zValidator('json', refreshTokenSchema), refreshToken);
auth.post('/logout', authMiddleware, zValidator('json', logoutSchema), logout);

export default auth;