
import app from '../../../../index';
import { describe, it, expect } from 'bun:test';

describe('Referral Module', () => {
  it('should get referrals for a user', async () => {
    // Create a user and get a token
    const registerResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Mr',
        fullName: 'Test User',
        dateOfBirth: '1990-01-01',
        email: 'testuser@example.com',
        phoneNumber: '1234567890',
        password: 'password123',
      }),
    });
    const { token } = await registerResponse.json();

    const response = await app.request('/api/v1/referrals', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('referrals');
  });

  it('should get referral earnings for a user', async () => {
    // Create a user and get a token
    const registerResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Mr',
        fullName: 'Test User',
        dateOfBirth: '1990-01-01',
        email: 'testuser@example.com',
        phoneNumber: '1234567890',
        password: 'password123',
      }),
    });
    const { token } = await registerResponse.json();

    const response = await app.request('/api/v1/referrals/earnings', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('earnings');
  });
});
