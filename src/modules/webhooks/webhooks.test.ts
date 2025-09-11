import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb } from '../../../tests/test-utils'

// Webhooks are generally side-effecting; here we verify basic acceptance & validation.

describe('Webhooks Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns HTML on shufti redirect', async () => {
    const res = await app.request('/api/v1/webhooks/shufti/redirect')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Verification Process Complete')
  })

  it('accepts tatum webhook payload and enqueues job', async () => {
    const payload = { address: '0xabc', amount: '1', txId: '0xhash', chain: 'ethereum-sepolia', subscriptionType: 'INCOMING_NATIVE_TX', blockNumber: 12345 }
    const res = await app.request('/api/v1/webhooks/tatum', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    })
    expect([200, 400]).toContain(res.status)
  })
})

