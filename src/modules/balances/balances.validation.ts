import { z } from 'zod';

export const assetIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid asset ID')
});
