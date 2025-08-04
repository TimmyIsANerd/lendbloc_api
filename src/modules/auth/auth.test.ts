import { describe, it, expect, beforeEach } from 'bun:test';
import app from '../../../index';

describe('Auth Module', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const req = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'John Doe',
          dateOfBirth: '01/01/1990',
          email: 'john.doe@example.com',
          socialIssuanceNumber: '1234567890',
          password: 'password123',
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('message', 'User registered successfully');
      expect(data).toHaveProperty('userId');
    });

    it('should return a 409 conflict error if the user already exists', async () => {
      // First, register a user
      const registerReq = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'Jane Doe',
          dateOfBirth: '01/01/1990',
          email: 'jane.doe@example.com',
          socialIssuanceNumber: '0987654321',
          password: 'password123',
        }),
      });
      await app.fetch(registerReq);

      // Then, try to register the same user again
      const req = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'Jane Doe',
          dateOfBirth: '01/01/1990',
          email: 'jane.doe@example.com',
          socialIssuanceNumber: '0987654321',
          password: 'password123',
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data).toHaveProperty('error', 'User with this email, phone number, or social issuance number already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should send an OTP to the user', async () => {
      // First, register a user
      const registerReq = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'Login User',
          dateOfBirth: '01/01/1990',
          email: 'login.user@example.com',
          socialIssuanceNumber: '1122334455',
          password: 'password123',
        }),
      });
      await app.fetch(registerReq);

      const req = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login.user@example.com',
          password: 'password123',
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('message', 'An OTP has been sent to your email/phone.');
    });
  });

  describe('POST /api/v1/auth/verify-login', () => {
    it('should verify the OTP and return an access token', async () => {
      // First, register a user and get an OTP
      const registerReq = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'Verify User',
          dateOfBirth: '01/01/1990',
          email: 'verify.user@example.com',
          socialIssuanceNumber: '5566778899',
          password: 'password123',
        }),
      });
      await app.fetch(registerReq);

      const loginReq = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'verify.user@example.com',
          password: 'password123',
        }),
      });
      await app.fetch(loginReq);

      // This is a placeholder for the OTP. In a real test, you would need to get the OTP from the email/SMS.
      const otp = '123456';

      const req = new Request('http://localhost/api/v1/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'verify.user@example.com',
          otp: otp,
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('accessToken');
    });
  });

  describe('POST /api/v1/auth/request-password-reset', () => {
    it('should send a password reset OTP to the user', async () => {
      // First, register a user
      const registerReq = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'Reset User',
          dateOfBirth: '01/01/1990',
          email: 'reset.user@example.com',
          socialIssuanceNumber: '1231231234',
          password: 'password123',
        }),
      });
      await app.fetch(registerReq);

      const req = new Request('http://localhost/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'reset.user@example.com',
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('message', 'Password reset requested. Check your email/phone for OTP.');
    });
  });

  describe('POST /api/v1/auth/set-password', () => {
    it('should set a new password for the user', async () => {
      // First, register a user and request a password reset
      const registerReq = new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Mr',
          fullName: 'SetPass User',
          dateOfBirth: '01/01/1990',
          email: 'setpass.user@example.com',
          socialIssuanceNumber: '4321432143',
          password: 'password123',
        }),
      });
      await app.fetch(registerReq);

      const resetReq = new Request('http://localhost/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'setpass.user@example.com',
        }),
      });
      await app.fetch(resetReq);

      // This is a placeholder for the OTP. In a real test, you would need to get the OTP from the email/SMS.
      const otp = '12345';

      const req = new Request('http://localhost/api/v1/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'setpass.user@example.com',
          otp: otp,
          password: 'newpassword123',
        }),
      });
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty('message', 'Password set successfully');
    });
  });
});