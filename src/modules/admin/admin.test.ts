import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import app from '../../../index';
import Admin from '../../models/Admin';
import { sign } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function dataUrlFromBytes(mime: string, size: number): Blob {
  const bytes = new Uint8Array(size).fill(65); // 'A'
  return new Blob([bytes], { type: mime });
}

describe('Admin Avatar', () => {
  let adminId: string;
  let token: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI!);

    const admin = await Admin.create({
      fullName: 'Admin User',
      username: 'adminuser',
      email: 'admin@example.com',
      secondaryEmail: 'admin2@example.com',
      passwordHash: 'hash',
      isEmailVerified: true,
      isPhoneNumberVerified: true,
    });
    adminId = admin._id.toString();
    token = await sign({ adminId, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + (60 * 60) }, JWT_SECRET);
  });

  afterAll(async () => {
    await Admin.deleteMany({});
    await mongoose.connection.close();
  });

  it('should reject when no token is provided', async () => {
    const req = new Request('http://localhost/api/v1/admin/profile', { method: 'GET' });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
  });

  it('should upload a valid PNG avatar under 3MB', async () => {
    const form = new FormData();
    const blob = dataUrlFromBytes('image/png', 1024); // 1KB
    form.append('avatar', blob, 'avatar.png');

    const res = await app.fetch(new Request('http://localhost/api/v1/admin/profile/avatar', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('message', 'Avatar uploaded successfully');

    const refreshed = await Admin.findById(adminId);
    expect(refreshed?.avatar).toBeTruthy();
    expect(refreshed?.avatar?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('should reject non-image mime types', async () => {
    const form = new FormData();
    const blob = dataUrlFromBytes('application/octet-stream', 1024);
    form.append('avatar', blob, 'file.bin');

    const res = await app.fetch(new Request('http://localhost/api/v1/admin/profile/avatar', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('should enforce 3MB size limit', async () => {
    const form = new FormData();
    const blob = dataUrlFromBytes('image/jpeg', 3 * 1024 * 1024 + 1); // just over 3MB
    form.append('avatar', blob, 'large.jpg');

    const res = await app.fetch(new Request('http://localhost/api/v1/admin/profile/avatar', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'File size exceeds 3MB limit');
  });

  it('should delete the avatar', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/admin/profile/avatar', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('message', 'Avatar removed successfully');

    const refreshed = await Admin.findById(adminId);
    expect(refreshed?.avatar).toBeUndefined();
  });
});

