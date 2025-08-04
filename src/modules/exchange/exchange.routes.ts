import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  swapCrypto,
  voteForCoin,
} from './exchange.controller';
import {
  swapSchema,
  voteCoinSchema,
} from './exchange.validation';

const exchange = new Hono();

exchange.use('/*', authMiddleware);
exchange.post('/swap', zValidator('json', swapSchema), swapCrypto);
exchange.post('/vote', zValidator('json', voteCoinSchema), voteForCoin);

export default exchange;
