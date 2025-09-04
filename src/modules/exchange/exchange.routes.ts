import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  swapCrypto,
  voteForCoin,
} from './exchange.controller';
import {
  swapCryptoSchema,
  voteForCoinSchema,
} from './exchange.validation';

const exchange = new Hono();

exchange.use('/*', authMiddleware);
exchange.post('/swap', zValidator('json', swapCryptoSchema), swapCrypto);
exchange.post('/vote', zValidator('json', voteForCoinSchema), voteForCoin);

export default exchange;
