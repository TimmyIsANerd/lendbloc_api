import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { createAssetSchema, listAssetsQuerySchema, updateAssetSchema } from './assets.validation';
import { createAsset, listAssets, getAsset, updateAsset, listAsset, delistAsset } from './assets.controller';

const router = new Hono();
router.use('/*', adminAuthMiddleware());

router.post('/', zValidator('json', createAssetSchema), createAsset);
router.get('/', zValidator('query', listAssetsQuerySchema), listAssets);
router.get('/overview', zValidator('query', listAssetsQuerySchema), listAssetsOverview);
router.get('/:id', getAsset);
router.get('/:id/fees', getAssetFees);
router.put('/:id', zValidator('json', updateAssetSchema), updateAsset);
router.put('/:id/fees', zValidator('json', updateAssetFeesOnlySchema), updateAssetFees);
router.post('/:id/list', listAsset);
router.post('/:id/delist', delistAsset);

export default router;
