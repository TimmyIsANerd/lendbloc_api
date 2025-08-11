import { Hono, type Context } from 'hono';
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import {
  registerUserSchema,
  verifyEmailSchema,
  requestPhoneOtp,
  verifyPhoneSchema,
  loginUserSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
} from './auth.validation';
import {
  registerUser,
  verifyEmail,
  sendPhone,
  verifyPhone,
  loginUser,
  verifyLogin,
  requestPasswordReset,
  setPassword,
} from './auth.controller';

const auth = new Hono();

const phoneLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 1,
  standardHeaders: 'draft-6',
  keyGenerator: async (c: Context) => {
    const body = await c.req.json();

    console.log(body);

    return body.userId as string
  },
});

auth.post('/register', zValidator('json', registerUserSchema), registerUser);
auth.post("/verify/email", zValidator('json', verifyEmailSchema), verifyEmail);
auth.post("/send/phone", zValidator('json', requestPhoneOtp), phoneLimiter, sendPhone);
auth.post("/verify/phone", zValidator('json', verifyPhoneSchema), verifyPhone);
auth.post('/login', zValidator('json', loginUserSchema), loginUser);
auth.post('/verify-login', zValidator('json', verifyOtpSchema), verifyLogin);
auth.post(
  '/request-password-reset',
  zValidator('json', requestPasswordResetSchema),
  requestPasswordReset
);
auth.post('/set-password', zValidator('json', setPasswordSchema), setPassword);

export default auth;