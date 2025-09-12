import Asset from '../../models/Asset';
import UserBalance from '../../models/UserBalance';

/**
 * Ensures a user has UserBalance documents (balance=0, locked=0) for the top N LISTED assets.
 * Top is determined by marketCap desc, ties broken by symbol asc.
 */
export async function ensureUserTopBalances(userId: string, limit = 20) {
  const assets = await Asset.find({ status: 'LISTED' })
    .select('_id symbol marketCap')
    .sort({ marketCap: -1, symbol: 1 })
    .limit(limit)
    .lean();

  if (!assets || assets.length === 0) return { created: 0, total: 0 };

  const ops = assets.map((a) => ({
    updateOne: {
      filter: { userId, assetId: a._id },
      update: { $setOnInsert: { balance: 0, locked: 0 } },
      upsert: true,
    },
  }));

  const res = await UserBalance.bulkWrite(ops, { ordered: false });
  const upserts = (res.upsertedCount ?? 0) || Object.keys((res as any).upsertedIds || {}).length || 0;
  return { created: upserts, total: assets.length };
}
