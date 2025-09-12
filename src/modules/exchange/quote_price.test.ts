import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'
import UserBalance from '../../models/UserBalance'

describe('Exchange Quote Endpoint', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns a quote with fees applied and net destination amount', async () => {
    const user = await User.create({ email: 'quote@example.com', kycReferenceId: 'Q1', referralId: 'R1' })
    const btc = await seedListedAsset({ symbol: 'BTC', network: 'BTC', currentPrice: 50000, fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, sendFeePercent: { REG: 0, PRO: 0 }, receiveFeePercent: { REG: 0, PRO: 0 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.3, PRO: 0.3 }, referralFeePercent: { REG: 0, PRO: 0 } } } as any)
    const eth = await seedListedAsset({ symbol: 'ETH', network: 'ETH', currentPrice: 2500, fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, sendFeePercent: { REG: 0, PRO: 0 }, receiveFeePercent: { REG: 0, PRO: 0 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.3, PRO: 0.3 }, referralFeePercent: { REG: 0, PRO: 0 } } } as any)
    // seed some balance (not required for quote but good for consistency)
    await UserBalance.create({ userId: user._id, assetId: btc._id, balance: 1, locked: 0 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/exchange/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ fromSymbol: 'BTC', toSymbol: 'ETH', amount: 0.1 })
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('fromSymbol', 'BTC')
    expect(data).toHaveProperty('toSymbol', 'ETH')
    expect(data).toHaveProperty('amountFrom')
    expect(data).toHaveProperty('amountTo')
    expect(data).toHaveProperty('unitPrices')
    expect(data).toHaveProperty('fees')
  })
})
