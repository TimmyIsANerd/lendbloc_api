import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  quoteSwap,
  priceChange,
  swapBySymbol,
  voteForCoin,
} from './exchange.controller';
import {
  quoteSchema,
  priceChangeQuerySchema,
  swapBySymbolSchema,
  voteForCoinSchema,
} from './exchange.validation';

const exchange = new Hono();

exchange.use('/*', authMiddleware);

// New endpoints
exchange.post('/quote', zValidator('json', quoteSchema), quoteSwap);
exchange.get('/price-change', zValidator('query', priceChangeQuerySchema), priceChange);
exchange.post('/swap', zValidator('json', swapBySymbolSchema), swapBySymbol);

// Keep vote endpoint
exchange.post('/vote', zValidator('json', voteForCoinSchema), voteForCoin);

export default exchange;
