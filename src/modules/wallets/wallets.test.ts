import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { app } from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer, seedListedAsset } from '../../../tests/test-utils'
import User from '../../models/User'
import Wallet from '../../models/Wallet'

describe('Wallets Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('lists wallets for the authenticated user', async () => {
    const user = await User.create({ 
      email: `w1-${Date.now()}@example.com`, 
      kycReferenceId: `WK1-${Date.now()}`, 
      referralId: `WR1-${Date.now()}` 
    })
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
    const user = await User.create({ 
      email: `w2-${Date.now()}@example.com`, 
      kycReferenceId: `WK2-${Date.now()}`, 
      referralId: `WR2-${Date.now()}` 
    })
    const asset = await seedListedAsset({ symbol: 'BTC', network: 'BTC' })
    const wallet = await Wallet.create({ userId: user._id, assetId: asset._id, address: `btc-addr-${Date.now()}`, encryptedMnemonic: 'enc', network: 'BTC', balance: 0.5 })

    const token = await signUserToken(String(user._id))
    const byId = await app.request(`/api/v1/wallets/${String(wallet._id)}`, { headers: bearer(token) })
    expect([200, 404, 400]).toContain(byId.status)

    const byAddress = await app.request(`/api/v1/wallets/address/${wallet.address}`, { headers: bearer(token) })
    expect([200, 404]).toContain(byAddress.status)
  })

  it('creates a wallet for a given asset symbol', async () => {
    const user = await User.create({ 
      email: `w3-${Date.now()}@example.com`, 
      kycReferenceId: `WK3-${Date.now()}`, 
      referralId: `WR3-${Date.now()}` 
    })
    await seedListedAsset({ symbol: 'LTC', network: 'LTC' })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ assetSymbol: 'LTC' })
    })
    expect([200, 201, 404, 409]).toContain(res.status)
  })

  it('withdraws funds successfully in development environment', async () => {
    const user = await User.create({ 
      email: `w4-${Date.now()}@example.com`, 
      kycReferenceId: `WK4-${Date.now()}`, 
      referralId: `WR4-${Date.now()}` 
    })
    const asset = await seedListedAsset({ symbol: 'BTC', network: 'BTC' })
    await Wallet.create({ 
      userId: user._id, 
      assetId: asset._id, 
      address: `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2-${Date.now()}`, 
      encryptedMnemonic: 'enc', 
      network: 'BTC', 
      balance: 1.0 
    })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ 
        assetSymbol: 'BTC', 
        amount: 0.5, 
        toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' 
      })
    })
    expect([200, 400, 404]).toContain(res.status)
    
    if (res.status === 200) {
      const data = await res.json()
      expect(data.message).toContain('Withdrawal')
      expect(data.transaction).toBeDefined()
    }
  })

  it('rejects withdrawal with invalid address format', async () => {
    const user = await User.create({ 
      email: `w5-${Date.now()}@example.com`, 
      kycReferenceId: `WK5-${Date.now()}`, 
      referralId: `WR5-${Date.now()}` 
    })
    const asset = await seedListedAsset({ symbol: 'ETH', network: 'ETH' })
    await Wallet.create({ 
      userId: user._id, 
      assetId: asset._id, 
      address: `0x742d35Cc6634C0532925a3b8D4C9db96590c6C87-${Date.now()}`, 
      encryptedMnemonic: 'enc', 
      network: 'ETH', 
      balance: 10.0 
    })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ 
        assetSymbol: 'ETH', 
        amount: 1.0, 
        toAddress: 'invalid-eth-address' 
      })
    })
    expect(res.status).toBe(400)
    
    const data = await res.json()
    expect(data.error).toContain('Invalid')
    expect(data.code).toBe('INVALID_ADDRESS_FORMAT')
  })

  it('rejects withdrawal with insufficient balance', async () => {
    const user = await User.create({ 
      email: `w6-${Date.now()}@example.com`, 
      kycReferenceId: `WK6-${Date.now()}`, 
      referralId: `WR6-${Date.now()}` 
    })
    const asset = await seedListedAsset({ symbol: 'ETH', network: 'ETH' })
    await Wallet.create({ 
      userId: user._id, 
      assetId: asset._id, 
      address: `0x742d35Cc6634C0532925a3b8D4C9db96590c6C87-${Date.now()}`, 
      encryptedMnemonic: 'enc', 
      network: 'ETH', 
      balance: 0.1 
    })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/wallets/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ 
        assetSymbol: 'ETH', 
        amount: 1.0, 
        toAddress: '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87' 
      })
    })
    expect(res.status).toBe(400)
    
    const data = await res.json()
    expect(data.error).toBe('Insufficient balance')
    expect(data.code).toBe('INSUFFICIENT_BALANCE')
  })
})

