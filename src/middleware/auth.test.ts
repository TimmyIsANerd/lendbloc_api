import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer } from '../../../tests/test-utils'
import User from '../../models/User'

// Minimal coverage of auth middleware-protected routes is handled in other module tests.

describe('Auth Middleware smoke', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('rejects requests without token', async () => {
    const res = await app.request('/api/v1/users/profile')
    expect([401]).toContain(res.status)
  })

  it('accepts requests with valid user token', async () => {
    const user = await User.create({ email: 'guard@example.com', kycReferenceId: 'GM1', referralId: 'GR1' })
    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/users/profile', { headers: bearer(token) })
    expect([200, 404]).toContain(res.status)
  })
})

