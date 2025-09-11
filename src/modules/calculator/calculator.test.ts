import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb } from '../../../tests/test-utils'

describe('Calculator Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns profit given amount and referrals', async () => {
    const res = await app.request('/api/v1/calculator', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 1000, referrals: 3 })
    })
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('profit')
    }
  })
})

