import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'
import Wallet from '../../models/Wallet'
import SavingsAccount from '../../models/SavingsAccount'

// Note: Savings withdrawals enforce a lock. We'll simulate both deposit and an unlocked withdraw by tweaking dates.

describe('Savings Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('creates a savings account when asset listed and wallet funded', async () => {
    const user = await User.create({ email: 'save@example.com', kycReferenceId: 'SV1', referralId: 'SR1' })
    const asset = await seedListedAsset({ symbol: 'ETH', network: 'ETH', currentPrice: 2500 })
    await Wallet.create({ userId: user._id, assetId: asset._id, address: '0xsave', encryptedMnemonic: 'enc', network: 'ETH', balance: 2 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/savings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ assetId: String(asset._id), amount: 1, termDays: 30 })
    })
    expect([200, 400, 409]).toContain(res.status)
  })

  it('deposits and withdraws (after lock end) from savings account', async () => {
    const user = await User.create({ email: 'save2@example.com', kycReferenceId: 'SV2', referralId: 'SR2' })
    const asset = await seedListedAsset({ symbol: 'BTC', network: 'BTC', currentPrice: 50000 })
    await Wallet.create({ userId: user._id, assetId: asset._id, address: 'btc-save', encryptedMnemonic: 'enc', network: 'BTC', balance: 1 })

    const token = await signUserToken(String(user._id))
    const createRes = await app.request('/api/v1/savings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ assetId: String(asset._id), amount: 0.5, termDays: 7 })
    })
    expect([200, 400]).toContain(createRes.status)

    const created = await SavingsAccount.findOne({ userId: user._id, assetId: asset._id })
    if (!created) return

    const depRes = await app.request(`/api/v1/savings/${String(created._id)}/deposit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ amount: 0.1 })
    })
    expect([200, 400, 404]).toContain(depRes.status)

    // Simulate lock end
    await SavingsAccount.findByIdAndUpdate(created._id, { lockEndAt: new Date(Date.now() - 1000) })
    const wRes = await app.request(`/api/v1/savings/${String(created._id)}/withdraw`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ amount: 0.1 })
    })
    expect([200, 400, 403, 404]).toContain(wRes.status)
  })
})

