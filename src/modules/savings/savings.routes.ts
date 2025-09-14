import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  createSavingsAccount,
  depositToSavingsAccount,
  withdrawFromSavingsAccount,
  unsaveSavingsAccount,
  getSavingsByAsset,
  listSavings,
  getSavingsHistory,
  interestAnalytics,
} from './savings.controller';
import {
  createSavingsAccountSchema,
  depositToSavingsAccountSchema,
  withdrawFromSavingsAccountSchema,
  idParamSchema,
  assetParamSchema,
  historyQuerySchema,
  interestAnalyticsQuerySchema,
} from './savings.validation';

const savings = new Hono();

savings.use('/*', authMiddleware);

// Create savings (save)
savings.post('/', zValidator('json', createSavingsAccountSchema), createSavingsAccount);

// Unsave (close at maturity)
savings.post('/:id/unsave', zValidator('param', idParamSchema), unsaveSavingsAccount);

// Disabled legacy routes (kept for backward compat but return 400/403)
savings.post('/:id/deposit', zValidator('json', depositToSavingsAccountSchema), depositToSavingsAccount);
savings.post('/:id/withdraw', zValidator('json', withdrawFromSavingsAccountSchema), withdrawFromSavingsAccount);

// Queries
savings.get('/', listSavings);
savings.get('/asset/:id', zValidator('param', assetParamSchema), getSavingsByAsset);
savings.get('/asset/:id/history', zValidator('param', assetParamSchema), zValidator('query', historyQuerySchema), getSavingsHistory);

// Analytics: interest earned per month in USD
savings.get('/analytics/interest', zValidator('query', interestAnalyticsQuerySchema), interestAnalytics);

export default savings;
