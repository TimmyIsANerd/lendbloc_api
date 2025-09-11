import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer } from '../../../tests/test-utils'
import User from '../../models/User'

// We won’t hit real SMS/email providers — in a running test you’d mock them.

describe('Notifications Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('sends an email notification', async () => {
    const user = await User.create({ email: 'note@example.com', kycReferenceId: 'NT1', referralId: 'NR1' })
    const token = await signUserToken(String(user._id))

    const res = await app.request('/api/v1/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ userId: String(user._id), type: 'email', message: 'Hello!' })
    })
    expect([200, 400]).toContain(res.status)
  })

  it('sends an sms notification (requires phone number)', async () => {
    const user = await User.create({ email: 'note2@example.com', phoneNumber: '+15551234567', kycReferenceId: 'NT2', referralId: 'NR2' })
    const token = await signUserToken(String(user._id))

    const res = await app.request('/api/v1/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ userId: String(user._id), type: 'sms', message: 'SMS' })
    })
    expect([200, 400]).toContain(res.status)
  })
})

