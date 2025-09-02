import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import mongoose from 'mongoose';
import app from '../../../index';
import SystemSetting from '../../models/SystemSetting';
import { sign } from 'hono/jwt';

const makeAdminToken = async () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const adminId = new mongoose.Types.ObjectId();
  return await sign({ adminId, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secret);
};

describe('Admin Settings - Savings APY', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI!);
  });

  afterEach(async () => {
    await SystemSetting.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should return default settings (creates with savingsApy=0 if missing)', async () => {
    const token = await makeAdminToken();

    const req = new Request('http://localhost/api/v1/admin/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('savingsApy');
    expect(typeof data.savingsApy).toBe('number');
  });

  it('should update savings APY and reflect in subsequent GET', async () => {
    const token = await makeAdminToken();

    const putReq = new Request('http://localhost/api/v1/admin/settings/savings-apy', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ savingsApy: 7.5 }),
    });

    const putRes = await app.fetch(putReq);
    const putData = await putRes.json();

    expect(putRes.status).toBe(200);
    expect(putData).toHaveProperty('message', 'Savings APY updated successfully');
    expect(putData).toHaveProperty('savingsApy', 7.5);

    const getReq = new Request('http://localhost/api/v1/admin/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const getRes = await app.fetch(getReq);
    const getData = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getData).toHaveProperty('savingsApy', 7.5);
  });
});

