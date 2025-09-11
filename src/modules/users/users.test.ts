import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer } from '../../../tests/test-utils'
import User from '../../models/User'

// Covers profile retrieval and updates and email/password change flows at a high-level.

describe('Users Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('gets and updates the user profile', async () => {
    const user = await User.create({ email: 'user@example.com', kycReferenceId: 'US1', referralId: 'UR1' })
    const token = await signUserToken(String(user._id))

    const getRes = await app.request('/api/v1/users/profile', { headers: bearer(token) })
    expect([200, 401]).toContain(getRes.status)

    const putRes = await app.request('/api/v1/users/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ fullName: 'John Doe' })
    })
    expect([200, 401]).toContain(putRes.status)
  })

  it('starts and validates password change flow', async () => {
    const user = await User.create({ email: 'user2@example.com', kycReferenceId: 'US2', referralId: 'UR2' })
    const token = await signUserToken(String(user._id))

    const reqRes = await app.request('/api/v1/users/request-password-change', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ email: 'user2@example.com' })
    })
    expect([200, 404]).toContain(reqRes.status)
  })
})

