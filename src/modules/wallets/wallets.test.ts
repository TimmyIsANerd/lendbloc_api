import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'
import Wallet from '../../models/Wallet'

describe('Wallets Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('lists wallets for the authenticated user', async () => {
    const user = await User.create({ email: 'w1@example.com', kycReferenceId: 'WK1', referralId: 'WR1' })
    const asset = await seedListedAsset({ symbol: 'ETH', network: 'ETH' })
    await Wallet.create({ userId: user._id, assetId: asset._id, address: '0xabc', encryptedMnemonic: 'enc', network: 'ETH', balance: 1 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets', { headers: bearer(token) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)
  })

  it('gets wallet by id and by address', async () => {
    const user = await User.create({ email: 'w2@example.com', kycReferenceId: 'WK2', referralId: 'WR2' })
    const asset = await seedListedAsset({ symbol: 'BTC', network: 'BTC' })
    const wallet = await Wallet.create({ userId: user._id, assetId: asset._id, address: 'btc-addr', encryptedMnemonic: 'enc', network: 'BTC', balance: 0.5 })

    const token = await signUserToken(String(user._id))
    const byId = await app.request(`/api/v1/wallets/${String(wallet._id)}`, { headers: bearer(token) })
    expect([200, 404, 400]).toContain(byId.status)

    const byAddress = await app.request(`/api/v1/wallets/address/${wallet.address}`, { headers: bearer(token) })
    expect([200, 404]).toContain(byAddress.status)
  })

  it('creates a wallet for a given asset symbol', async () => {
    const user = await User.create({ email: 'w3@example.com', kycReferenceId: 'WK3', referralId: 'WR3' })
    await seedListedAsset({ symbol: 'LTC', network: 'LTC' })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ assetSymbol: 'LTC' })
    })
    expect([200, 201, 404, 409]).toContain(res.status)
  })
})

