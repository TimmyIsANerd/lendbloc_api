import { type Context } from 'hono';
import User from '../../models/User';
import Loan from '../../models/Loan';
import SavingsAccount from '../../models/SavingsAccount';
import Transaction from '../../models/Transaction';
import Admin from '../../models/Admin';
import AdminOtp from '../../models/AdminOtp';
import AdminRefreshToken from '../../models/AdminRefreshToken';
import bcrypt from 'bcrypt';
import { sign } from 'hono/jwt';
import { generateOtp } from '../../helpers/otp';
import { z } from 'zod';
import { 
    adminRegisterSchema, 
    adminSendPhoneOTPSchema, 
    adminVerifyPhoneOTPSchema, 
    adminLoginSchema, 
    adminVerifyLoginSchema, 
    adminLogoutSchema
} from './admin.validation';
import { sendSms } from '../../helpers/twilio';
import { sendEmail } from '../../helpers/email';
import { otpVerificationEmail } from '../../templates/otp-verification';

export const getUsers = async (c: Context) => {
  const users = await User.find();
  return c.json(users);
};

export const getLoans = async (c: Context) => {
  const loans = await Loan.find();
  return c.json(loans);
};

export const getSavings = async (c: Context) => {
  const savings = await SavingsAccount.find();
  return c.json(savings);
};

export const getTransactions = async (c: Context) => {
  const transactions = await Transaction.find();
  return c.json(transactions);
};

export const adminRegister = async (c: Context) => {
  const { role, fullName, username, email, secondaryEmail, password } = c.req.valid('json' as never) as z.infer<typeof adminRegisterSchema>;

  try {
    const existingAdmin = await Admin.findOne({ $or: [{ email }, { username }] });
    if (existingAdmin) {
      return c.json({ error: 'Admin with this email or username already exists' }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newAdmin = await Admin.create({
      role,
      fullName,
      username,
      email,
      secondaryEmail,
      passwordHash,
    });

    const { passwordHash: _, ...adminData } = newAdmin.toObject();

    return c.json({ message: 'Admin registered successfully', admin: adminData }, 201);
  } catch (error) {
    console.error('Error registering admin:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminSendPhoneOtp = async (c: Context) => {
  const { userId, phone } = c.req.valid('json' as never) as z.infer<typeof adminSendPhoneOTPSchema>;

  try {
    const admin = await Admin.findById(userId);
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404);
    }

    const otp = generateOtp(5);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await AdminOtp.findOneAndUpdate(
      { userId },
      { code: otp, expiresAt },
      { upsert: true, new: true }
    );

    await sendSms(phone, `Your LendBloc verification code is: ${otp}`);

    return c.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending phone OTP:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminVerifyPhoneOtp = async (c: Context) => {
  const { userId, otp, phone } = c.req.valid('json' as never) as z.infer<typeof adminVerifyPhoneOTPSchema>;

  try {
    const admin = await Admin.findById(userId);
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404);
    }

    const otpRecord = await AdminOtp.findOne({ userId, code: otp });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    await AdminOtp.deleteOne({ _id: otpRecord._id });

    admin.phoneNumber = phone;
    admin.isPhoneNumberVerified = true;
    await admin.save();

    return c.json({ message: 'Phone number verified successfully' });
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminLogin = async (c: Context) => {
  const { email, password } = c.req.valid('json' as never) as z.infer<typeof adminLoginSchema>;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const otp = generateOtp(5);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await AdminOtp.findOneAndUpdate(
      { userId: admin._id },
      { code: otp, expiresAt },
      { upsert: true, new: true }
    );

    await sendEmail(admin.email, 'LendBloc Admin Login Verification', otpVerificationEmail(otp, 10));

    return c.json({ message: 'OTP sent for login verification', userId: admin._id });
  } catch (error) {
    console.error('Error during admin login:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminVerifyLogin = async (c: Context) => {
  const { userId, otp } = c.req.valid('json' as never) as z.infer<typeof adminVerifyLoginSchema>;

  try {
    const admin = await Admin.findById(userId);
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404);
    }

    const otpRecord = await AdminOtp.findOne({ userId, code: otp });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }

    await AdminOtp.deleteOne({ _id: otpRecord._id });

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const accessToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
    const refreshToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

    await AdminRefreshToken.create({
      userId: admin._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)),
    });

    return c.json({ accessToken, refreshToken });
  } catch (error) {
    console.error('Error verifying admin login:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminLogout = async (c: Context) => {
  const { refreshToken } = c.req.valid('json' as never) as z.infer<typeof adminLogoutSchema>;

  try {
    await AdminRefreshToken.deleteOne({ token: refreshToken });
    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during admin logout:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};