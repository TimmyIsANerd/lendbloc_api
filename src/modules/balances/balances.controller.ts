import { type Context } from 'hono';
import UserBalance from '../../models/UserBalance';
import Asset from '../../models/Asset';
import { getUsdRatesForNetwork } from '../../helpers/tatum/rates';

export const listUserBalances = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  try {
    // Fetch all LISTED assets the platform supports
    const assets = await Asset.find({ status: 'LISTED' })
      .select('name symbol iconUrl network kind tokenAddress decimals status')
      .sort({ marketCap: -1, symbol: 1 });

    // Fetch existing balances for the user
    const balances = await UserBalance.find({ userId })
      .select('assetId balance locked createdAt updatedAt')
      .lean();

    const balMap = new Map<string, typeof balances[number]>();
    for (const b of balances) balMap.set(String(b.assetId), b);

    // Fetch USD rates per network using Tatum
    const usdRates = new Map<string, number>();
    // Group symbols by network to reuse Tatum instances efficiently
    const symbolsByNetwork = new Map<string, Set<string>>();
    for (const a of assets) {
      const set = symbolsByNetwork.get(a.network) ?? new Set<string>();
      set.add(a.symbol);
      symbolsByNetwork.set(a.network, set);
    }

    for (const [net, set] of symbolsByNetwork) {
      const ratesForNet = await getUsdRatesForNetwork(net, Array.from(set));
      for (const [sym, price] of ratesForNet) usdRates.set(sym, price);
    }

    let totalUsd = 0;

    const data = assets.map((asset) => {
      const b = balMap.get(String(asset._id));
      const balance = b?.balance ?? 0;
      const usdPrice = usdRates.get(asset.symbol) ?? 0;
      const usdValue = balance * usdPrice;
      totalUsd += usdValue;
      return {
        _id: b?._id ?? undefined,
        userId,
        assetId: asset,
        balance,
        locked: b?.locked ?? 0,
        usdPrice,
        usdValue,
        createdAt: b?.createdAt ?? undefined,
        updatedAt: b?.updatedAt ?? undefined,
      };
    });

    return c.json({ data, totalUsd });
  } catch (error) {
    console.error('Error listing balances:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const getUserBalanceByAsset = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const assetId = c.req.param('id');
  try {
    const asset = await Asset.findById(assetId).select('name symbol iconUrl network kind tokenAddress decimals status');
    if (!asset || asset.status !== 'LISTED') {
      return c.json({ error: 'Asset not found or not listed' }, 404);
    }

    const bal = await UserBalance.findOne({ userId, assetId })
      .select('assetId balance locked createdAt updatedAt')
      .lean();

    if (!bal) {
      return c.json({
        userId,
        assetId: asset,
        balance: 0,
        locked: 0,
      });
    }

    return c.json({
      _id: bal._id,
      userId,
      assetId: asset,
      balance: bal.balance,
      locked: bal.locked,
      createdAt: bal.createdAt,
      updatedAt: bal.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};
