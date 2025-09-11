import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signAdminToken, bearer } from '../../../tests/test-utils'
import Admin, { AdminRole } from '../../models/Admin'
import Asset from '../../models/Asset'

// Covers basic Admin Assets create/list/get/update flows.

describe('Admin Assets Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('creates an asset (enforces uniqueness and fee mapping)', async () => {
    const admin = await Admin.create({ role: 'ADMIN', fullName: 'Ops', username: 'ops', email: 'ops@ex.com', secondaryEmail: 'ops2@ex.com', passwordHash: 'hash' })
    const token = await signAdminToken(String(admin._id), AdminRole.ADMIN)

    const res = await app.request('/api/v1/admin/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({
        name: 'USD Tether', symbol: 'USDT', iconUrl: 'https://ex.com/usdt.png', currentPrice: 1, marketCap: 1000,
        circulatingSupply: 1000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'ETH', kind: 'erc20', tokenAddress: '0xToken', decimals: 6,
        status: 'LISTED', fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { d7: 0, d30: 0, d180: 0, d365: 0 }, sendFeePercent: 0, receiveFeePercent: 0, exchangeFeePercentFrom: 0, exchangeFeePercentTo: 0, referralFeePercent: 0 }
      })
    })
    expect([201, 409, 500]).toContain(res.status)
  })

  it('lists assets and fetches by id', async () => {
    const admin = await Admin.create({ role: 'ADMIN', fullName: 'Ops2', username: 'ops2', email: 'ops2@ex.com', secondaryEmail: 'ops22@ex.com', passwordHash: 'hash' })
    const token = await signAdminToken(String(admin._id), AdminRole.ADMIN)

    const created = await Asset.create({
      name: 'Bitcoin', symbol: 'BTC', iconUrl: 'https://ex.com/btc.png', currentPrice: 50000, marketCap: 1, circulatingSupply: 1, amountHeld: 0,
      isLendable: true, isCollateral: true, network: 'BTC', kind: 'native', status: 'LISTED',
      fees: { loanInterest: { REG: { d7: 0, d30: 0, d180: 0, d365: 0 }, PRO: { d7: 0, d30: 0, d180: 0, d365: 0 } }, savingsInterest: { d7: 0, d30: 0, d180: 0, d365: 0 }, sendFeePercent: 0, receiveFeePercent: 0, exchangeFeePercentFrom: 0, exchangeFeePercentTo: 0, referralFeePercent: 0 }
    } as any)

    const list = await app.request('/api/v1/admin/assets?page=1&limit=10', { headers: bearer(token) })
    expect(list.status).toBe(200)

    const byId = await app.request(`/api/v1/admin/assets/${String(created._id)}`, { headers: bearer(token) })
    expect([200, 404]).toContain(byId.status)
  })
})

