import { describe, it, expect, afterEach, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import app from '../../../index';
import User from '../../models/User';
import Otp from '../../models/Otp';
import Wallet from '../../models/Wallet';
import Asset from '../../models/Asset';
import { vi } from 'bun:test';

describe('Auth Module', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI!);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Otp.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/v1/auth/register', () => {
    let assetFindOneSpy: any;
    let walletCreateSpy: any;

    beforeEach(() => {
      assetFindOneSpy = vi.spyOn(Asset, 'findOne');
      walletCreateSpy = vi.spyOn(Wallet, 'create');

      assetFindOneSpy.mockImplementation((query: any) => {
        if (query.symbol === 'BTC') {
          return { _id: new mongoose.Types.ObjectId(), symbol: 'BTC' };
        } else if (query.symbol === 'ETH') {
          return { _id: new mongoose.Types.ObjectId(), symbol: 'ETH' };
        } else if (query.symbol === 'TRX') {
          return { _id: new mongoose.Types.ObjectId(), symbol: 'TRX' };
        }
        return null;
      });
    });

    afterEach(() => {
      assetFindOneSpy.mockRestore();
      walletCreateSpy.mockRestore();
    });

    it('should register a new user successfully and create wallets', async () => {
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

      expect(walletCreateSpy).toHaveBeenCalledTimes(3); // BTC, ETH, TRX
      expect(walletCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ assetId: expect.any(mongoose.Types.ObjectId), address: expect.stringContaining('btc_address_') }));
      expect(walletCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ assetId: expect.any(mongoose.Types.ObjectId), address: expect.stringContaining('0x') })); // ETH address starts with 0x
      expect(walletCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ assetId: expect.any(mongoose.Types.ObjectId), address: expect.stringContaining('T') })); // TRX address starts with T
    });

    it('should return a 409 conflict error if the user already exists', async () => {
      // First, register a user
      await User.create({
        title: 'Mr',
        fullName: 'Jane Doe',
        dateOfBirth: '01/01/1990',
        email: 'jane.doe@example.com',
        socialIssuanceNumber: '0987654321',
        passwordHash: await bcrypt.hash('password123', 10),
      });

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
      await User.create({
        title: 'Mr',
        fullName: 'Login User',
        dateOfBirth: '01/01/1990',
        email: 'login.user@example.com',
        socialIssuanceNumber: '1122334455',
        passwordHash: await bcrypt.hash('password123', 10),
      });

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
      const user = await User.create({
        title: 'Mr',
        fullName: 'Verify User',
        dateOfBirth: '01/01/1990',
        email: 'verify.user@example.com',
        socialIssuanceNumber: '5566778899',
        passwordHash: await bcrypt.hash('password123', 10),
      });

      const loginReq = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'verify.user@example.com',
          password: 'password123',
        }),
      });
      await app.fetch(loginReq);

      const otpDoc = await Otp.findOne({ userId: user._id });

      const req = new Request('http://localhost/api/v1/auth/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'verify.user@example.com',
          otp: otpDoc?.code,
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
      await User.create({
        title: 'Mr',
        fullName: 'Reset User',
        dateOfBirth: '01/01/1990',
        email: 'reset.user@example.com',
        socialIssuanceNumber: '1231231234',
        passwordHash: await bcrypt.hash('password123', 10),
      });

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
      const user = await User.create({
        title: 'Mr',
        fullName: 'SetPass User',
        dateOfBirth: '01/01/1990',
        email: 'setpass.user@example.com',
        socialIssuanceNumber: '4321432143',
        passwordHash: await bcrypt.hash('password123', 10),
      });

      const resetReq = new Request('http://localhost/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'setpass.user@example.com',
        }),
      });
      await app.fetch(resetReq);

      const otpDoc = await Otp.findOne({ userId: user._id });

      const req = new Request('http://localhost/api/v1/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'setpass.user@example.com',
          otp: otpDoc?.code,
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