import { type Context } from 'hono';
import { z } from 'zod';
import User, { type IUser } from '../../models/User';
import Otp from '../../models/Otp';
import RefreshToken from '../../models/RefreshToken';
import Wallet from '../../models/Wallet';
import bcrypt from 'bcrypt';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import { generateOtp } from '../../helpers/otp/index';
import { sendEmail } from '../../helpers/email/index';
import { otpVerificationEmail } from '../../templates/otp-verification';
import { initializeWalletSystem } from '../../helpers/wallet/index';

import {
  registerUserSchema,
  loginUserSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema
} from './auth.validation';

export const registerUser = async (c: Context) => {
  const { title, fullName, dateOfBirth, email, socialIssuanceNumber, phone, password } = c.req.valid('json' as never) as z.infer<
    typeof registerUserSchema
  >;

  const passwordHash = await bcrypt.hash(password, 10);

  // Check Environment using process
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Check if a user with the same email or phone number already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { phoneNumber: phone },
        { socialIssuanceNumber: socialIssuanceNumber },
      ],
    });

    if (existingUser) {
      return c.json({ error: 'User with this email, phone number, or social issuance number already exists' }, 409);
    }

    const user: IUser = await User.create({
      title,
      fullName,
      dateOfBirth,
      email,
      socialIssuanceNumber,
      phoneNumber: phone,
      passwordHash,
      isKycVerified: isProduction ? false : true,
      isEmailVerified: isProduction ? false : true,
      isPhoneNumberVerified: isProduction ? false : true,
    });

    // Initialize Wallet Creation
    // Add a guard to check if wallets are already initialized for this user
    const existingWallets = await Wallet.countDocuments({ userId: user._id });
    if (existingWallets === 0) {
      await initializeWalletSystem(user._id as string);
    } else {
      console.log(`Wallets already initialized for user ${user._id}. Skipping initialization.`);
    }

    // Deliver Email Verification OTP
    const otpCode = await generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

    // Create OTP Record
    console.log('OTP Code:', otpCode);

    await Otp.findOneAndUpdate(
      { userId: user._id },
      { code: otpCode, expiresAt },
      { upsert: true, new: true }
    );

    // Send OTP to Email First
    sendEmail(user.email, 'Email Verification OTP', otpVerificationEmail(otpCode, 10));

    return c.json({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    console.error('Error during user registration:', error);
    return c.json({ error: 'An unexpected error occurred during registration.' }, 500);
  }
};

export const verifyEmail = async (c: Context) => {
  const { email, otp } = c.req.valid('json' as never) as z.infer<
    typeof verifyEmailSchema
  >;

  const user = await User.findOne({ email });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const storedOtp = await Otp.findOne({
    userId: user._id,
  });

  if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: storedOtp?._id });
    return c.json({ error: 'Invalid or expired OTP' }, 400);
  }

  await Otp.deleteOne({ _id: storedOtp?._id });

  await User.findByIdAndUpdate(user._id, { isEmailVerified: true });

  return c.json({ message: 'Email verified successfully' }, 200);
}

export const sendPhone = async (c: Context) => {
  const { phone } = c.req.valid('json' as never) as z.infer<
    typeof verifyPhoneSchema
  >;

  const user = await User.findOne({ phoneNumber: phone });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const otpCode = await generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Create OTP Record
  console.log('OTP Code:', otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt },
    { upsert: true, new: true }
  );

  // Deliver SMS OTP

  return c.json({ message: 'An OTP has been sent to your phone number.' });
}

export const verifyPhone = async (c: Context) => {
  const { phone, otp } = c.req.valid('json' as never) as z.infer<
    typeof verifyPhoneSchema
  >;

  const user = await User.findOne({ phoneNumber: phone });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const storedOtp = await Otp.findOne({
    userId: user._id,
  });

  if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: storedOtp?._id });
    return c.json({ error: 'Invalid or expired OTP' }, 400);
  }

  await Otp.deleteOne({ _id: storedOtp?._id });

  await User.findByIdAndUpdate(user._id, { isPhoneNumberVerified: true });

  return c.json({ message: 'Phone number verified successfully' });
}

export const loginUser = async (c: Context) => {
  const { email, phone, password } = c.req.valid('json' as never) as z.infer<
    typeof loginUserSchema
  >;

  // Check if one or the other is provided
  if (!email && !phone) {
    return c.json({ error: 'Email or phone number is required' }, 400);
  }

  if (email && phone) {
    return c.json({ error: 'Only one of email or phone number should be provided' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
      { phoneNumber: phone },
    ],
  });

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes


  // @todo replace console.log with email/sms delivery
  console.log('OTP Code:', otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt },
    { upsert: true, new: true }
  );

  return c.json({ message: 'An OTP has been sent to your email/phone.' });
};

export const verifyLogin = async (c: Context) => {
  const { email, phone, otp } = c.req.valid('json' as never) as z.infer<
    typeof verifyOtpSchema
  >;

  if (!email && !phone) {
    return c.json({ error: 'Email or phone number is required' }, 400);
  }

  if (email && phone) {
    return c.json({ error: 'Only one of email or phone number should be provided' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
      { phoneNumber: phone },
    ],
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const storedOtp = await Otp.findOne({
    userId: user._id,
  });

  if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
    // If OTP is invalid or expired, delete the OTP document
    await Otp.deleteOne({ _id: storedOtp?._id });
    return c.json({ error: 'Invalid or expired OTP' }, 400);
  }

  await Otp.deleteOne({ _id: storedOtp?._id });

  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const accessToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
  const refreshToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)),
  });

  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json({ accessToken });
};

export const requestPasswordReset = async (c: Context) => {
  const { email, phone } = c.req.valid('json' as never) as z.infer<
    typeof requestPasswordResetSchema
  >;

  if (!email && !phone) {
    return c.json({ error: 'Email or phone number is required' }, 400);
  }

  if (email && phone) {
    return c.json({ error: 'Only one of email or phone number should be provided' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
      { phoneNumber: phone },
    ],
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const otpCode = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit OTP
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

  console.log("OTP Code: ", otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt },
    { upsert: true, new: true }
  );

  return c.json({ message: 'Password reset requested. Check your email/phone for OTP.' });
};

export const setPassword = async (c: Context) => {
  const { email, phone, otp, password } = c.req.valid('json' as never) as z.infer<
    typeof setPasswordSchema
  >;

  if (!email && !phone) {
    return c.json({ error: 'Email or phone number is required' }, 400);
  }

  if (email && phone) {
    return c.json({ error: 'Only one of email or phone number should be provided' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
      { phoneNumber: phone },
    ],
  }).select('passwordHash');

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const storedOtp = await Otp.findOne({
    userId: user._id,
  });

  if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: storedOtp?._id });

    return c.json({ error: 'Invalid or expired OTP' }, 400);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (passwordMatch) {
    return c.json({ error: 'New password can\'t be the same as old password' }, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await User.findByIdAndUpdate(user._id, { passwordHash });

  await Otp.deleteOne({ _id: storedOtp._id });

  return c.json({ message: 'Password set successfully' });
};