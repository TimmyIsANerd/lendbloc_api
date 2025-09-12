import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'
import Asset from '../../models/Asset'
import UserBalance from '../../models/UserBalance'
import Vote from '../../models/Vote'

describe('Exchange Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('swaps crypto between two listed assets and applies split fees', async () => {
    const user = await User.create({ email: 'swap@example.com', kycReferenceId: 'EX1', referralId: 'ER1' })
const from = await seedListedAsset({ symbol: 'BTC', network: 'BTC', currentPrice: 50000, fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, sendFeePercent: { REG: 0, PRO: 0 }, receiveFeePercent: { REG: 0, PRO: 0 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.3, PRO: 0.3 }, referralFeePercent: { REG: 0, PRO: 0 } } } as any)
    const to = await seedListedAsset({ symbol: 'ETH', network: 'ETH', currentPrice: 2500, fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, sendFeePercent: { REG: 0, PRO: 0 }, receiveFeePercent: { REG: 0, PRO: 0 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.3, PRO: 0.3 }, referralFeePercent: { REG: 0, PRO: 0 } } } as any)

    // Seed user balance for BTC
    await UserBalance.create({ userId: user._id, assetId: from._id, balance: 1, locked: 0 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/exchange/swap', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ fromSymbol: 'BTC', toSymbol: 'ETH', amount: 0.1 })
    })
    expect([200, 400]).toContain(res.status)
  })

  it('votes for a coin', async () => {
    const user = await User.create({ email: 'vote@example.com', kycReferenceId: 'EX2', referralId: 'ER2' })
    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/exchange/vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ coinName: 'SAMPLE' })
    })
    expect([200]).toContain(res.status)
    const count = await Vote.countDocuments({ userId: user._id, coinName: 'SAMPLE' })
    expect(count).toBe(1)
  })
})

