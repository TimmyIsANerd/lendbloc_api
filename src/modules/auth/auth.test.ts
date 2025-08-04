import { describe, it, expect, beforeEach } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import app from '../../../index';

describe('Auth Module', () => {
  const api = treaty(app);

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'John Doe',
        dateOfBirth: '01/01/1990',
        email: 'john.doe@example.com',
        socialIssuanceNumber: '1234567890',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'User registered successfully');
      expect(response.data).toHaveProperty('userId');
    });

    it('should return a 409 conflict error if the user already exists', async () => {
      // First, register a user
      await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'Jane Doe',
        dateOfBirth: '01/01/1990',
        email: 'jane.doe@example.com',
        socialIssuanceNumber: '0987654321',
        password: 'password123',
      });

      // Then, try to register the same user again
      const response = await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'Jane Doe',
        dateOfBirth: '01/01/1990',
        email: 'jane.doe@example.com',
        socialIssuanceNumber: '0987654321',
        password: 'password123',
      });

      expect(response.status).toBe(409);
      expect(response.data).toHaveProperty('error', 'User with this email, phone number, or social issuance number already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should send an OTP to the user', async () => {
      // First, register a user
      await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'Login User',
        dateOfBirth: '01/01/1990',
        email: 'login.user@example.com',
        socialIssuanceNumber: '1122334455',
        password: 'password123',
      });

      const response = await api.api.v1.auth.login.post({
        email: 'login.user@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'An OTP has been sent to your email/phone.');
    });
  });

  describe('POST /api/v1/auth/verify-login', () => {
    it('should verify the OTP and return an access token', async () => {
      // First, register a user and get an OTP
      await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'Verify User',
        dateOfBirth: '01/01/1990',
        email: 'verify.user@example.com',
        socialIssuanceNumber: '5566778899',
        password: 'password123',
      });

      await api.api.v1.auth.login.post({
        email: 'verify.user@example.com',
        password: 'password123',
      });

      // This is a placeholder for the OTP. In a real test, you would need to get the OTP from the email/SMS.
      const otp = '123456';

      const response = await api.api.v1.auth.verify-login.post({
        email: 'verify.user@example.com',
        otp: otp,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
    });
  });

  describe('POST /api/v1/auth/request-password-reset', () => {
    it('should send a password reset OTP to the user', async () => {
      // First, register a user
      await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'Reset User',
        dateOfBirth: '01/01/1990',
        email: 'reset.user@example.com',
        socialIssuanceNumber: '1231231234',
        password: 'password123',
      });

      const response = await api.api.v1.auth.request-password-reset.post({
        email: 'reset.user@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Password reset requested. Check your email/phone for OTP.');
    });
  });

  describe('POST /api/v1/auth/set-password', () => {
    it('should set a new password for the user', async () => {
      // First, register a user and request a password reset
      await api.api.v1.auth.register.post({
        title: 'Mr',
        fullName: 'SetPass User',
        dateOfBirth: '01/01/1990',
        email: 'setpass.user@example.com',
        socialIssuanceNumber: '4321432143',
        password: 'password123',
      });

      await api.api.v1.auth.request-password-reset.post({
        email: 'setpass.user@example.com',
      });

      // This is a placeholder for the OTP. In a real test, you would need to get the OTP from the email/SMS.
      const otp = '12345';

      const response = await api.api.v1.auth.set-password.post({
        email: 'setpass.user@example.com',
        otp: otp,
        password: 'newpassword123',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Password set successfully');
    });
  });
});
