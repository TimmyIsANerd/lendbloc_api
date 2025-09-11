import { TatumSDK, Network } from '@tatumio/tatum'

// Map our internal network keys to Tatum networks (best-effort)
const mapToTatumNetwork = (net: string): Network => {
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
        const price = typeof rate === 'number' ? rate : Number(rate?.value ?? rate?.price ?? rate?.rate ?? 0)
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
