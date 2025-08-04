import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  registerUserSchema,
  loginUserSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
} from './auth.validation';
import {
  registerUser,
  loginUser,
  verifyLogin,
  requestPasswordReset,
  setPassword,
} from './auth.controller';

const auth = new Hono();

auth.post('/register', zValidator('json', registerUserSchema), registerUser);
auth.post('/login', zValidator('json', loginUserSchema), loginUser);
auth.post('/verify-login', zValidator('json', verifyOtpSchema), verifyLogin);
auth.post(
  '/request-password-reset',
  zValidator('json', requestPasswordResetSchema),
  requestPasswordReset
);
auth.post('/set-password', zValidator('json', setPasswordSchema), setPassword);

export default auth;