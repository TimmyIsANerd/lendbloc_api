
import { Context } from 'hono';
import axios from 'axios';
import Asset from '../../models/Asset';

export const getPrices = async (c: Context) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,litecoin&vs_currencies=usd');
    const prices = await response.json();
    return c.json(prices);
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};

// GET /api/v1/prices/trends
// Returns top 5 listed tradeable assets (by 24h volume change) with current USD price and volume change (24h) from CoinMarketCap.
export const getTopTrends = async (c: Context) => {
  try {
    // Gather listed assets from our platform
    const listed = await Asset.find({ status: 'LISTED' }).select('name symbol network').lean();
    if (!listed || listed.length === 0) return c.json({ items: [] });

    // De-duplicate by symbol, prefer networks in this order
    const prefOrder = ['ETH', 'BSC', 'TRON', 'BTC', 'LTC'];
    const bySymbol = new Map<string, any>();
    for (const a of listed) {
      const key = String(a.symbol).toUpperCase();
      if (!bySymbol.has(key)) {
        bySymbol.set(key, a);
      } else {
        const prev = bySymbol.get(key);
        const prevRank = prefOrder.indexOf(String(prev.network));
        const curRank = prefOrder.indexOf(String(a.network));
        if (curRank >= 0 && (prevRank < 0 || curRank < prevRank)) bySymbol.set(key, a);
      }
    }

    const symbols = Array.from(bySymbol.keys());

    const BASE_URL = process.env.CMC_BASE_URL || 'https://pro-api.coinmarketcap.com';
    const API_KEY = process.env.CMC_API_KEY;

    if (!API_KEY) {
      // Graceful fallback if no API key: return zeros with stored assets
      const fallback = symbols.slice(0, 5).map((sym) => ({
        symbol: sym,
        name: bySymbol.get(sym)?.name || sym,
        network: bySymbol.get(sym)?.network || null,
        priceUsd: 0,
        volume24h: 0,
        volumeChange24hPercent: 0,
        source: 'fallback',
      }));
      return c.json({ items: fallback });
    }

    // CMC quotes/latest supports comma-separated symbols
    // Limit symbols to a safe chunk size (e.g., 100) to avoid URL length issues
    const chunkSize = 100;
    const requests: Promise<any>[] = [];
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const batch = symbols.slice(i, i + chunkSize).join(',');
      requests.push(
        axios.get(`${BASE_URL}/v1/cryptocurrency/quotes/latest`, {
          headers: { 'X-CMC_PRO_API_KEY': API_KEY, Accept: 'application/json' },
          params: { symbol: batch, convert: 'USD' },
          timeout: 30000,
        })
      );
    }

    const results = await Promise.allSettled(requests);
    const dataBySymbol: Record<string, any> = {};
    for (const res of results) {
      if (res.status === 'fulfilled') {
        const d = res.value?.data?.data || {};
        for (const [sym, info] of Object.entries<any>(d)) dataBySymbol[sym.toUpperCase()] = info;
      }
    }

    // Map to items and select top 5 by volume_change_24h desc
    const itemsAll = symbols.map((sym) => {
      const cmc = dataBySymbol[sym] || {};
      const quote = cmc?.quote?.USD || {};
      return {
        symbol: sym,
        name: bySymbol.get(sym)?.name || cmc?.name || sym,
        network: bySymbol.get(sym)?.network || null,
        priceUsd: Number(quote?.price || 0),
        volume24h: Number(quote?.volume_24h || 0),
        volumeChange24hPercent: Number(quote?.volume_change_24h || 0),
        source: 'coinmarketcap',
      };
    });

    const top = itemsAll
      .sort((a, b) => (b.volumeChange24hPercent || 0) - (a.volumeChange24hPercent || 0))
      .slice(0, 5);

    return c.json({ items: top });
  } catch (error) {
    console.error('Top trends error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
