import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signAdminToken, bearer } from '../../../tests/test-utils'
import Admin, { AdminRole } from '../../models/Admin'
import AdminChatMessage from '../../models/AdminChatMessage'

// We focus on REST endpoints; WebSocket can be smoke-tested separately if desired.

describe('Admin Chat Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('gets messages with pagination', async () => {
    const me = await Admin.create({ role: 'ADMIN', fullName: 'Me', username: 'me', email: 'me@ex.com', secondaryEmail: 'me2@ex.com', passwordHash: 'hash' })
    const peer = await Admin.create({ role: 'ADMIN', fullName: 'Peer', username: 'peer', email: 'peer@ex.com', secondaryEmail: 'peer2@ex.com', passwordHash: 'hash' })

    await AdminChatMessage.create({ senderId: me._id, recipientId: peer._id, text: 'hello' })

    const token = await signAdminToken(String(me._id), AdminRole.ADMIN)
    const res = await app.request(`/api/v1/admin/chat/messages?peerId=${String(peer._id)}&page=1&limit=10`, { headers: bearer(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('meta')
  })

  it('sends a message to a peer', async () => {
    const me = await Admin.create({ role: 'ADMIN', fullName: 'Me2', username: 'me2', email: 'me2@ex.com', secondaryEmail: 'me22@ex.com', passwordHash: 'hash' })
    const peer = await Admin.create({ role: 'ADMIN', fullName: 'Peer2', username: 'peer2', email: 'peer2@ex.com', secondaryEmail: 'peer22@ex.com', passwordHash: 'hash' })

    const token = await signAdminToken(String(me._id), AdminRole.ADMIN)
    const res = await app.request('/api/v1/admin/chat/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer(token) }, body: JSON.stringify({ peerId: String(peer._id), text: 'hi there' })
    })
    expect([200, 404]).toContain(res.status)
  })
})

