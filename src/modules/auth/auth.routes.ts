import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import {
  registerUserSchema,
  verifyEmailSchema,
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
  keyGenerator: (c) => {
    const { phone } = c.req.valid('json' as never)
    return phone
  },
});

auth.post('/register', zValidator('json', registerUserSchema), registerUser);
auth.post("/verify/email", zValidator('json', verifyEmailSchema), verifyEmail);
auth.post("/send/phone", phoneLimiter, zValidator('json', verifyPhoneSchema), sendPhone);
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