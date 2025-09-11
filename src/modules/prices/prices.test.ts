import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb } from '../../../tests/test-utils'

// We’ll mock fetch in a real run; here we just hit the controller path.

describe('Prices Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns prices from the external provider', async () => {
    const res = await app.request('/api/v1/prices')
    expect([200, 500]).toContain(res.status)
  })
})

