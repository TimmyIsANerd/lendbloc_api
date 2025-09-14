import { getUsdPriceForAsset, getUsdRatesForNetwork } from '../helpers/tatum/rates';

const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

// Simple in-memory cache with TTL to reduce external calls
const cache = new Map<string, { value: number; at: number }>();
const TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS ?? 15000); // 15s default

function keyOf(network: string, symbol: string) {
  return `${network.toUpperCase()}:${symbol.toUpperCase()}`;
}

function isFresh(ts: number) {
  return Date.now() - ts < TTL_MS;
}

export async function getUsdPrice(network: string, symbol: string, fallback?: number): Promise<number> {
  const key = keyOf(network, symbol);

  // Development: prefer deterministic DB value
  if (IS_DEV) return Number(fallback ?? 0) || 0;

  const hit = cache.get(key);
  if (hit && isFresh(hit.at)) return hit.value;

  try {
    const v = await getUsdPriceForAsset(network, symbol);
    const n = Number(v || 0) || 0;
    cache.set(key, { value: n, at: Date.now() });
    if (n > 0) return n;
    return Number(fallback ?? 0) || 0;
  } catch {
    return Number(fallback ?? 0) || 0;
  }
}

export async function getUsdPrices(network: string, symbols: string[], fallbacks?: Record<string, number>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const missing: string[] = [];

  if (IS_DEV) {
    for (const s of symbols) {
      out.set(s.toUpperCase(), Number(fallbacks?.[s] ?? 0) || 0);
    }
    return out;
  }

  // Attempt cache hits first
  for (const s of symbols) {
    const key = keyOf(network, s);
    const hit = cache.get(key);
    if (hit && isFresh(hit.at)) {
      out.set(s.toUpperCase(), hit.value);
    } else {
      missing.push(s);
    }
  }

  if (missing.length > 0) {
    try {
      const rates = await getUsdRatesForNetwork(network, missing);
      for (const s of missing) {
        const n = Number(rates.get(s) || 0) || 0;
        out.set(s.toUpperCase(), n > 0 ? n : Number(fallbacks?.[s] ?? 0) || 0);
        cache.set(keyOf(network, s), { value: n, at: Date.now() });
      }
    } catch {
      for (const s of missing) {
        out.set(s.toUpperCase(), Number(fallbacks?.[s] ?? 0) || 0);
      }
    }
  }

  return out;
}
