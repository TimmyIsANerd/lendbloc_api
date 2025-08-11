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
import { sendSms } from '../../helpers/twilio/index';
import { otpVerificationEmail } from '../../templates/otp-verification';
import { passwordResetRequestEmail } from '../../templates/password-reset-request';
import { initializeWalletSystem } from '../../helpers/wallet/index';
import { nanoid } from 'nanoid';
import { verifyUser } from '../../helpers/shufti';

import {
  registerUserSchema,
  loginUserSchema,
  requestPhoneOtpSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  initializeKYCSchema,
  confirmKYCStatusSchema
} from './auth.validation';

export const registerUser = async (c: Context) => {
  const { title, fullName, dateOfBirth, email, phone, password } = c.req.valid('json' as never) as z.infer<
    typeof registerUserSchema
  >;

  const passwordHash = await bcrypt.hash(password, 10);

  // Check Environment using process
  // const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Check if a user with the same email or phone number already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { phoneNumber: phone },
      ],
    });

    if (existingUser) {
      return c.json({ error: 'User with this email, phone number already exists' }, 409);
    }

    const user: IUser = await User.create({
      title,
      fullName,
      dateOfBirth,
      email,
      phoneNumber: phone,
      passwordHash,
      kycReferenceId: nanoid(),
      isKycVerified: false,
      isEmailVerified: false,
      isPhoneNumberVerified: false,
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
    sendEmail(user.email, '[LENDBLOCK] Email Verification OTP', otpVerificationEmail(otpCode, 10));

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

  // Check if Email is already verified
  if (user.isEmailVerified) {
    return c.json({ error: 'Email is already verified' }, 400);
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
  const { phone, userId } = c.req.valid('json' as never) as z.infer<
    typeof requestPhoneOtpSchema
  >;

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    return c.json({ error: 'Phone number must be a valid E.164 formatted number' }, 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if Phone Number is already verified
  if (user.isPhoneNumberVerified) {
    return c.json({ error: 'Phone number is already verified' }, 400);
  }

  const existingOtp = await Otp.findOne({ userId: user._id });

  if (existingOtp && existingOtp.createdAt > new Date(Date.now() - 5 * 60 * 1000)) {
    return c.json({ error: 'You must wait 5 minutes before requesting a new OTP.' }, 429);
  }

  const otpCode = await generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Create OTP Record
  console.log('OTP Code:', otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt, createdAt: new Date() },
    { upsert: true, new: true }
  );

  // Deliver SMS OTP
  // await sendSms(user.phoneNumber, `Your OTP is ${otpCode}. It expires in 10 minutes.`);

  return c.json({ message: 'An OTP has been sent to your phone number.' });
}

export const verifyPhone = async (c: Context) => {
  const { userId, otp, phone } = c.req.valid('json' as never) as z.infer<
    typeof verifyPhoneSchema
  >;

  const phoneRegex = /^\+\d{1,15}$/;

  if (!phoneRegex.test(phone)) {
    return c.json({ error: 'Phone number must be a valid E.164 formatted number' }, 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.phoneNumber !== phone) {
    return c.json({ error: 'Phone number does not match' }, 400);
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

export const initializeKYC = async (c: Context) => {
  const { userId } = c.req.valid('json' as never) as z.infer<
    typeof initializeKYCSchema
  >;

  // Find User using UserId
  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if they haven't verified kyc
  if (user.isKycVerified) {
    return c.json({ error: 'User is already verified. Please login.' }, 400);
  }

  // If Kyc not verified, use shufti's response to provide verification page
  // try {
  //   const verificationData = await verifyUser(user.kycReferenceId);
  //   return c.json({ verificationUrl: verificationData.verification_url });
  // } catch (error: any) {
  //   console.error('Error initializing KYC:', error.message);
  //   return c.json({ error: 'Failed to initialize KYC verification.' }, 500);
  // }


  return c.json({ message: "KYC Initialized" }, 200)
}

export const confirmKYCStatus = async (c: Context) => {
  const { userId, clientDevice } = c.req.valid('json' as never) as z.infer<
    typeof confirmKYCStatusSchema
  >;

  // Find User using UserId
  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if they haven't verified kyc
  if (user.isKycVerified) {
    return c.json({ error: 'User is already verified. Please login.' }, 400);
  }

  // Go ahead and update user record to isKYCVerified to true
  await User.findByIdAndUpdate(user._id, { isKycVerified: true });

  // If Kyc not verified, since shufti doesn't work right now, send access and refresh token to user to allow dashboard access
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const accessToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret); // 15 minutes
  const refreshToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret); // 7 days


  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)), // 3 Days
  });

  if (clientDevice === "mobile") {
    return c.json({ accessToken, refreshToken, message: "Login & KYC verification successful" });
  }

  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 3, // 3 days
  });

  return c.json({ accessToken, message: "Login & KYC verification successful" });
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

  // Check if User's Email, Phone & Identity have been verified
  if (!user.isEmailVerified || !user.isPhoneNumberVerified) {
    return c.json({
      error: 'User is not verified', verificationStatus: {
        email: user.isEmailVerified ? "verified" : "not verified",
        phone: user.isPhoneNumberVerified ? "verified" : "not verified"
      }
    }, 401);
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

  // Send Email to User
  // sendEmail(user.email, '[LENDBLOCK] Login OTP', otpVerificationEmail(otpCode, 10));

  return c.json({ message: 'An OTP has been sent to your email/phone.' });
};

export const verifyLogin = async (c: Context) => {
  const { email, phone, otp, clientDevice } = c.req.valid('json' as never) as z.infer<
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
    if (storedOtp && storedOtp.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: storedOtp?._id });
    }

    return c.json({ error: 'Invalid or expired OTP' }, 400);
  }

  await Otp.deleteOne({ _id: storedOtp?._id });

  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const accessToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
  const refreshToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)), // 3 Days
  });

  if (clientDevice === "mobile") {
    return c.json({ accessToken, refreshToken });
  }

  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 3, // 3 days
  });

  return c.json({ accessToken });
};

export const requestPasswordReset = async (c: Context) => {
  const { email } = c.req.valid('json' as never) as z.infer<
    typeof requestPasswordResetSchema
  >;

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
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

  // Send Password Reset Email
  sendEmail(user.email, '[LENDBLOCK] Password Reset Request', passwordResetRequestEmail(otpCode, 10));

  return c.json({ message: 'Password reset requested. Check your email/phone for OTP.' });
};

export const setPassword = async (c: Context) => {
  const { email, otp, password } = c.req.valid('json' as never) as z.infer<
    typeof setPasswordSchema
  >;

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const user = await User.findOne({
    $or: [
      { email: email },
    ],
  }).select('passwordHash');

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const storedOtp = await Otp.findOne({
    userId: user._id,
  });

  if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
    if (storedOtp && storedOtp.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: storedOtp?._id });
    }

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
