import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  createSavingsAccount,
  depositToSavingsAccount,
  withdrawFromSavingsAccount,
} from './savings.controller';
import {
  createSavingsAccountSchema,
  depositWithdrawSchema,
} from './savings.validation';

const savings = new Hono();

savings.use('/*', authMiddleware);
savings.post('/', zValidator('json', createSavingsAccountSchema), createSavingsAccount);
savings.post('/:id/deposit', zValidator('json', depositWithdrawSchema), depositToSavingsAccount);
savings.post('/:id/withdraw', zValidator('json', depositWithdrawSchema), withdrawFromSavingsAccount);

export default savings;
