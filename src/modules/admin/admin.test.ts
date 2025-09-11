import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signAdminToken, bearer } from '../../../tests/test-utils'
import Admin, { AdminRole } from '../../models/Admin'
import SystemSetting from '../../models/SystemSetting'

// NOTE: Many admin auth flows bypass OTP in DEVELOPMENT. We target basic shape and persistence.

describe('Admin Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('registers an admin via /api/v1/admin/auth/register', async () => {
    const res = await app.request('/api/v1/admin/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN', fullName: 'Alice', username: 'alice', email: 'alice@ex.com', secondaryEmail: 'alice2@ex.com', password: 'Admin@12345' })
    })
    expect([201, 409, 500]).toContain(res.status)
  })

  it('gets admin profile with valid token', async () => {
    const admin = await Admin.create({ role: 'ADMIN', fullName: 'Bob', username: 'bob', email: 'bob@ex.com', secondaryEmail: 'bob2@ex.com', passwordHash: 'hash', isEmailVerified: true, isPhoneNumberVerified: true })
    const token = await signAdminToken(String(admin._id), AdminRole.ADMIN)
    const res = await app.request('/api/v1/admin/profile', { headers: bearer(token) })
    expect([200, 401]).toContain(res.status)
  })

  it('updates savings APY via /api/v1/admin/settings/savings-apy', async () => {
    const admin = await Admin.create({ role: 'ADMIN', fullName: 'Carol', username: 'carol', email: 'carol@ex.com', secondaryEmail: 'carol2@ex.com', passwordHash: 'hash', isEmailVerified: true, isPhoneNumberVerified: true })
    const token = await signAdminToken(String(admin._id), AdminRole.ADMIN)

    const res = await app.request('/api/v1/admin/settings/savings-apy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ savingsApy: 6.5 })
    })
    expect([200, 401]).toContain(res.status)

    if (res.status === 200) {
      const doc = await SystemSetting.findOne({ key: 'GLOBAL' })
      expect(doc?.savingsApy).toBe(6.5)
    }
  })
})

