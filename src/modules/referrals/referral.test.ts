import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer } from '../../../tests/test-utils'
import app from '../../../../index'
import User from '../../models/User'
import Referral from '../../models/Referral'
import Earning from '../../models/Earning'

describe('Referrals Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns referrals list for an authenticated user', async () => {
    const user = await User.create({ email: 'ref.owner@example.com', kycReferenceId: 'RREF1', referralId: 'CODE1' })
    const u2 = await User.create({ email: 'friend@example.com', kycReferenceId: 'RREF2', referralId: 'CODE2' })
    await Referral.create({ user: user._id, referredUsers: [u2._id] })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/referrals', { headers: bearer(token) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data?.referredUsers?.length ?? 0).toBe(1)
  })

  it('returns referral earnings for an authenticated user', async () => {
    const user = await User.create({ email: 'earn.owner@example.com', kycReferenceId: 'RREF3', referralId: 'CODE3' })
    const u2 = await User.create({ email: 'friend2@example.com', kycReferenceId: 'RREF4', referralId: 'CODE4' })
    const ref = await Referral.create({ user: user._id, referredUsers: [u2._id] })
    await Earning.create({ referral: ref._id, referredUser: u2._id, amount: 10 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/referrals/earnings', { headers: bearer(token) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})
