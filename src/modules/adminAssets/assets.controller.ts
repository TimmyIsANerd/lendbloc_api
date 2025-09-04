import { type Context } from 'hono';
import { z } from 'zod';
import Asset from '../../models/Asset';
import { createAssetSchema, updateAssetSchema, listAssetsQuerySchema } from './assets.validation';

export const createAsset = async (c: Context) => {
  const payload = c.req.valid('json' as never) as z.infer<typeof createAssetSchema>;

  try {
    const data = { ...payload } as any;
    // Normalize symbol upper-case for consistency
    data.symbol = data.symbol.toUpperCase();

    // Map legacy single exchangeFeePercent to split fees if needed
    if (data.fees) {
      const f = data.fees;
      if ((f.exchangeFeePercentFrom === undefined || f.exchangeFeePercentTo === undefined) && f.exchangeFeePercent !== undefined) {
        f.exchangeFeePercentFrom = f.exchangeFeePercentFrom ?? f.exchangeFeePercent;
        f.exchangeFeePercentTo = f.exchangeFeePercentTo ?? f.exchangeFeePercent;
        delete f.exchangeFeePercent;
      }
    }

    const asset = await Asset.create(data);
    return c.json({ message: 'Asset created', asset }, 201);
  } catch (error: any) {
    if (error?.code === 11000) {
      return c.json({ error: 'Duplicate asset for network (symbol or tokenAddress already exists).' }, 409);
    }
    console.error('Error creating asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const listAssets = async (c: Context) => {
  const query = c.req.valid('query' as never) as z.infer<typeof listAssetsQuerySchema>;
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (query.status) filter.status = query.status;
  if (query.network) filter.network = query.network;
  if (query.kind) filter.kind = query.kind;
  if (query.symbol) filter.symbol = query.symbol.toUpperCase();

  try {
    const [items, total] = await Promise.all([
      Asset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Asset.countDocuments(filter),
    ]);

    return c.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error listing assets:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const getAsset = async (c: Context) => {
  const id = c.req.param('id');
  try {
    const asset = await Asset.findById(id);
    if (!asset) return c.json({ error: 'Asset not found' }, 404);
    return c.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const updateAsset = async (c: Context) => {
  const id = c.req.param('id');
  const payload = c.req.valid('json' as never) as z.infer<typeof updateAssetSchema>;
  const data: any = { ...payload };
  if (data.symbol) data.symbol = data.symbol.toUpperCase();

  // Map legacy single exchangeFeePercent to split fees if needed
  if (data.fees) {
    const f = data.fees;
    if ((f.exchangeFeePercentFrom === undefined || f.exchangeFeePercentTo === undefined) && f.exchangeFeePercent !== undefined) {
      f.exchangeFeePercentFrom = f.exchangeFeePercentFrom ?? f.exchangeFeePercent;
      f.exchangeFeePercentTo = f.exchangeFeePercentTo ?? f.exchangeFeePercent;
      delete f.exchangeFeePercent;
    }
  }

  try {
    const asset = await Asset.findByIdAndUpdate(id, data, { new: true });
    if (!asset) return c.json({ error: 'Asset not found' }, 404);
    return c.json({ message: 'Asset updated', asset });
  } catch (error: any) {
    if (error?.code === 11000) {
      return c.json({ error: 'Duplicate asset for network (symbol or tokenAddress already exists).' }, 409);
    }
    console.error('Error updating asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const listAsset = async (c: Context) => {
  const id = c.req.param('id');
  try {
    const asset = await Asset.findByIdAndUpdate(id, { status: 'LISTED' }, { new: true });
    if (!asset) return c.json({ error: 'Asset not found' }, 404);
    return c.json({ message: 'Asset listed', asset });
  } catch (error) {
    console.error('Error listing asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const delistAsset = async (c: Context) => {
  const id = c.req.param('id');
  try {
    const asset = await Asset.findByIdAndUpdate(id, { status: 'DELISTED' }, { new: true });
    if (!asset) return c.json({ error: 'Asset not found' }, 404);
    return c.json({ message: 'Asset delisted', asset });
  } catch (error) {
    console.error('Error delisting asset:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

