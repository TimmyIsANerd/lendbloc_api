import { TatumSDK, Network } from '@tatumio/tatum'

// Map our internal network keys to Tatum networks (best-effort)
export const mapToTatumNetwork = (net: string): Network => {
  switch (net) {
    case 'ETH':
      return Network.ETHEREUM
    case 'BSC':
      // Tatum naming may vary; try both common keys with fallback to ETHEREUM
      return (Network as any).BNB_SMART_CHAIN || (Network as any).BINANCE_SMART_CHAIN || Network.ETHEREUM
    case 'TRON':
      return Network.TRON
    case 'BTC':
      return Network.BITCOIN
    case 'LTC':
      return Network.LITECOIN
    default:
      return Network.ETHEREUM
  }
}

function toNumber(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = Number(val)
    return isFinite(n) ? n : 0
  }
  if (val && typeof val === 'object') {
    // Common fields
    const candidates = [val.value, val.price, val.rate, val.usd, val.USD, val.amount, val.data?.rate, val.data?.value]
    for (const c of candidates) {
      const n = toNumber(c)
      if (n) return n
    }
    // As a last resort, scan numeric props
    for (const key of Object.keys(val)) {
      const n = toNumber((val as any)[key])
      if (n) return n
    }
  }
  return 0
}

export async function getUsdRatesForNetwork(networkKey: string, symbols: string[]): Promise<Map<string, number>> {
  const usdRates = new Map<string, number>()
  if (symbols.length === 0) return usdRates

  const network = mapToTatumNetwork(networkKey)
  let tatum: Awaited<ReturnType<typeof TatumSDK.init>> | null = null
  try {
    tatum = await TatumSDK.init({ network })
    await Promise.all(symbols.map(async (sym) => {
      try {
        const rate: any = await tatum!.rates.getCurrentRate(sym, 'USD')
        const price = toNumber(rate)
        usdRates.set(sym, isFinite(price) ? price : 0)
      } catch {
        usdRates.set(sym, 0)
      }
    }))
  } catch {
    // Default zeros on failure
    for (const s of symbols) usdRates.set(s, 0)
  } finally {
    try { await tatum?.destroy() } catch {}
  }
  return usdRates
}

export async function getUsdPriceForAsset(networkKey: string, symbol: string): Promise<number> {
  const map = await getUsdRatesForNetwork(networkKey, [symbol])
  return map.get(symbol) ?? 0
}
