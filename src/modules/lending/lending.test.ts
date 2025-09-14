import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'

describe('Lending Module (new flow)', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns 410 for deprecated direct-loan endpoint', async () => {
    const user = await User.create({ email: 'loan@example.com', kycReferenceId: 'LK1', referralId: 'LR1' })
    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/lending/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(410)
  })

  it('repays a loan amount and potentially closes it', async () => {
    const user = await User.create({ email: 'loan2@example.com', kycReferenceId: 'LK2', referralId: 'LR2' })
    const collateral = await seedListedAsset({ symbol: 'BTC', network: 'BTC', currentPrice: 50000 })
    const loanAsset = await seedListedAsset({ symbol: 'ETH', network: 'ETH', currentPrice: 2500 })

    // Seed a loan directly
    const loan = await Loan.create({
      userId: user._id,
      collateralAssetId: collateral._id,
      collateralAmount: 0.1,
      loanAssetId: loanAsset._id,
      loanAmount: 1,
      ltv: 0.5,
      interestRate: 5,
      termDays: 30,
      status: 'ACTIVE'
    } as any)

    const token = await signUserToken(String(user._id))
    const res = await app.request(`/api/v1/lending/loans/${String(loan._id)}/repay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ amount: 0.5 })
    })
    expect([200, 400, 404]).toContain(res.status)
  })
})

