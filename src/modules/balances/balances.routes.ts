import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import { listUserBalances, getUserBalanceByAsset } from './balances.controller';
import { assetIdParamSchema } from './balances.validation';

const router = new Hono();
router.use('/*', authMiddleware);

router.get('/', listUserBalances);
router.get('/:id', zValidator('param', assetIdParamSchema), getUserBalanceByAsset);

export default router;
