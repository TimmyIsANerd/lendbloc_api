import 'dotenv/config'
import axios from 'axios'
import connectDB from '../src/config/db'
import Asset, { type IAsset } from '../src/models/Asset'

// Supported network mapping
const PLATFORM_NAME_TO_NETWORK: Record<string, IAsset['network']> = {
  'ethereum': 'ETH',
  'eth': 'ETH',
  'bnb smart chain': 'BSC',
  'binance smart chain': 'BSC',
  'bsc': 'BSC',
  'tron': 'TRON',
  'bitcoin': 'BTC',
  'litecoin': 'LTC',
}

const SYMBOL_TO_NATIVE_NETWORK: Record<string, IAsset['network']> = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'LTC': 'LTC',
  'TRX': 'TRON',
  'BNB': 'BSC',
}

const DEFAULT_FEES = {
  loanInterest: {
    REG: { d7: 3, d30: 4, d180: 6, d365: 8 },
    PRO: { d7: 2, d30: 3, d180: 5, d365: 7 },
  },
  savingsInterest: { d7: 1, d30: 2, d180: 3, d365: 4 },
  sendFeePercent: 0.1,
  receiveFeePercent: 0.05,
  exchangeFeePercentFrom: 0.2,
  exchangeFeePercentTo: 0.2,
  referralFeePercent: 0.5,
} as any

const BASE_URL = process.env.CMC_BASE_URL || 'https://pro-api.coinmarketcap.com'
const API_KEY = process.env.CMC_API_KEY

if (!API_KEY) {
  console.error('CMC_API_KEY is not set. Please set it in your environment or .env file.')
  process.exit(1)
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-CMC_PRO_API_KEY': API_KEY,
    'Accept': 'application/json',
  },
  timeout: 60_000,
})

// Types from CMC
interface Listing {
  id: number
  name: string
  symbol: string
  slug: string
  circulating_supply: number
  quote: { USD: { price: number, market_cap: number } }
  platform: null | { id: number; name: string; slug: string; token_address?: string }
}

interface InfoResponseItem {
  id: number
  name: string
  symbol: string
  logo?: string
  urls?: Record<string, string[]>
  contract_address?: Array<{ contract_address: string; platform: { name: string; slug?: string } }>
}

async function fetchTopListings(limit = 100): Promise<Listing[]> {
  const { data } = await client.get('/v1/cryptocurrency/listings/latest', {
    params: {
      start: 1,
      limit,
      sort: 'market_cap',
      cryptocurrency_type: 'all',
      tag: 'all',
    },
  })
  return data?.data as Listing[]
}

async function fetchInfo(ids: number[]): Promise<Record<number, InfoResponseItem>> {
  if (ids.length === 0) return {}
  const { data } = await client.get('/v1/cryptocurrency/info', {
    params: { id: ids.join(',') },
  })
  const map: Record<number, InfoResponseItem> = {}
  for (const [idStr, item] of Object.entries<any>(data?.data || {})) {
    map[Number(idStr)] = item as InfoResponseItem
  }
  return map
}

function normalizePlatformName(name?: string): string | undefined {
  if (!name) return undefined
  return name.trim().toLowerCase()
}

function mapPlatformToNetwork(name?: string, slug?: string): IAsset['network'] | undefined {
  const n = normalizePlatformName(name)
  if (n && PLATFORM_NAME_TO_NETWORK[n]) return PLATFORM_NAME_TO_NETWORK[n]
  const s = slug?.trim().toLowerCase()
  if (s && PLATFORM_NAME_TO_NETWORK[s]) return PLATFORM_NAME_TO_NETWORK[s]
  return undefined
}

function toSafeIcon(url?: string): string {
  if (url && /^https?:\/\//i.test(url)) return url
  // fallback to a generic placeholder if logo is missing
  return 'https://static.coinpaper.io/icons/generic-crypto.png'
}

async function upsertAsset(doc: Partial<IAsset>) {
  if (doc.kind === 'native') {
    // unique by symbol + network
    const existing = await Asset.findOne({ symbol: doc.symbol, network: doc.network, tokenAddress: { $exists: false } })
    if (existing) {
      await Asset.updateOne({ _id: existing._id }, { $set: doc })
      return existing._id
    }
    const created = await Asset.create({ ...doc })
    return created._id
  } else {
    // token: unique by tokenAddress + network
    const existing = await Asset.findOne({ tokenAddress: doc.tokenAddress, network: doc.network })
    if (existing) {
      await Asset.updateOne({ _id: existing._id }, { $set: doc })
      return existing._id
    }
    const created = await Asset.create({ ...doc })
    return created._id
  }
}

async function main() {
  await connectDB()

  const TARGET_COUNT = Number(process.env.CMC_TARGET_COUNT || '20')

  console.log('Fetching top listings from CoinMarketCap...')
  const listings = await fetchTopListings(100) // fetch top 100 so we can filter to 20 supported assets
  const ids = (listings || []).map(l => l.id)
  console.log('Fetching logos/info for listings...')
  const infoMap = await fetchInfo(ids)

  let created = 0, updated = 0, skipped = 0
  const selectedKeys = new Set<string>() // prevent duplicates
  const preferredTokenNets: IAsset['network'][] = ['ETH', 'BSC', 'TRON']

  // iterate in order and select first N that map to supported networks
  for (const l of listings || []) {
    if ((created + updated) >= TARGET_COUNT) break

    const baseDoc = {
      name: l.name,
      symbol: l.symbol,
      iconUrl: toSafeIcon(infoMap[l.id]?.logo),
      currentPrice: Number(l.quote?.USD?.price ?? 0) || 0,
      marketCap: Number(l.quote?.USD?.market_cap ?? 0) || 0,
      circulatingSupply: Number(l.circulating_supply ?? 0) || 0,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      status: 'LISTED' as const,
      fees: DEFAULT_FEES,
    }

    // Decide network and kind
    if (!l.platform) {
      // Native coin
      const net = SYMBOL_TO_NATIVE_NETWORK[l.symbol]
      if (!net) { skipped++; continue }
      const key = `native:${l.symbol}:${net}`
      if (selectedKeys.has(key)) { skipped++; continue }
      const doc: Partial<IAsset> = {
        ...baseDoc,
        network: net,
        kind: 'native',
      }
      const existing = await Asset.findOne({ symbol: doc.symbol, network: doc.network, tokenAddress: { $exists: false } })
      await upsertAsset(doc)
      if (existing) updated++; else created++
      selectedKeys.add(key)
      continue
    }

    // Tokenized asset: prefer ETH, then BSC, then TRON; search listing.platform first, then info.contract_address[]
    const info = infoMap[l.id]

    // Build candidate networks and token addresses
    const candidates: { net: IAsset['network']; tokenAddress: string }[] = []

    // 1) from listing.platform (single)
    const pName = (l.platform as any)?.name as string | undefined
    const pSlug = (l.platform as any)?.slug as string | undefined
    const fromListingNet = mapPlatformToNetwork(pName, pSlug)
    const fromListingAddr = (l.platform as any)?.token_address as string | undefined
    if (fromListingNet && fromListingAddr) {
      candidates.push({ net: fromListingNet, tokenAddress: fromListingAddr })
    }

    // 2) from info.contract_address (may contain multiple platforms)
    for (const ca of info?.contract_address || []) {
      const net = mapPlatformToNetwork(ca.platform?.name, (ca.platform as any)?.slug)
      const tokenAddress = ca.contract_address
      if (net && tokenAddress) {
        candidates.push({ net, tokenAddress })
      }
    }

    // Deduplicate by net and token
    const uniq: Record<string, { net: IAsset['network']; tokenAddress: string }> = {}
    for (const c of candidates) {
      const k = `${c.net}:${c.tokenAddress.toLowerCase()}`
      if (!uniq[k]) uniq[k] = c
    }
    const uniqList = Object.values(uniq)

    // Sort by preference ETH -> BSC -> TRON
    uniqList.sort((a, b) => preferredTokenNets.indexOf(a.net) - preferredTokenNets.indexOf(b.net))

    // Pick the first that doesn't duplicate a previously selected key
    let picked: { net: IAsset['network']; tokenAddress: string } | undefined
    for (const c of uniqList) {
      const key = `token:${l.symbol}:${c.net}:${c.tokenAddress.toLowerCase()}`
      if (!selectedKeys.has(key)) { picked = c; break }
    }

    if (!picked) { skipped++; continue }

    const kind: IAsset['kind'] = picked.net === 'TRON' ? 'trc20' : 'erc20'
    const doc: Partial<IAsset> = {
      ...baseDoc,
      network: picked.net,
      kind,
      tokenAddress: picked.tokenAddress,
    }

    const before = await Asset.findOne({ tokenAddress: picked.tokenAddress, network: picked.net })
    await upsertAsset(doc)
    if (before) updated++; else created++
    selectedKeys.add(`token:${l.symbol}:${picked.net}:${picked.tokenAddress.toLowerCase()}`)
  }

  const total = created + updated
  if (total < TARGET_COUNT) {
    console.warn(`Warning: Only ${total} assets were seeded; target was ${TARGET_COUNT}. Consider increasing listing limit or expanding supported networks.`)
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, TotalSeeded: ${total}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('Seeding failed:', e)
  process.exit(1)
})
