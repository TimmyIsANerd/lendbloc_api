import { type Context } from 'hono';
import { z } from 'zod';
import User, { type IUser } from '../../models/User';
import Otp from '../../models/Otp';
import RefreshToken from '../../models/RefreshToken';
import Wallet from '../../models/Wallet';
import Referral from '../../models/Referral';
import bcrypt from 'bcrypt';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { generateOtp } from '../../helpers/otp/index';
import { sendEmail } from '../../helpers/email/index';
import { sendSms } from '../../helpers/twilio/index';
import { otpVerificationEmail } from '../../templates/otp-verification';
import { passwordResetRequestEmail } from '../../templates/password-reset-request';
import { initializeWalletSystem } from '../../helpers/wallet/index';
import { nanoid } from 'nanoid';
import shuftiPro, { type ShuftiVerifyPayload } from '../../helpers/shufti';
import KycRecord, { KycStatus } from '../../models/KycRecord';

import {
  registerUserSchema,
  loginUserSchema,
  requestPhoneOtpSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  kycDocumentSchema,
  kycFaceSchema,
  kycAddressSchema,
  kycConsentSchema,
  submitKycSchema,
  getKycStatusSchema,
  refreshTokenSchema,
  logoutSchema,
  validatePasswordResetOTPSchema,
  editPhoneNumberSchema
} from './auth.validation';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
};

const checkKycStatus = async (userId: string) => {
  const kycRecord = await KycRecord.findOne({ userId });
  if (kycRecord && kycRecord.shuftiVerificationResult) {
    const { document, face, consent, background_checks } = kycRecord.shuftiVerificationResult;
    if (document?.event === 'verification.accepted' &&
      face?.event === 'verification.accepted' &&
      consent?.event === 'verification.accepted' &&
      background_checks?.event === 'verification.accepted') {
      await User.findByIdAndUpdate(userId, { isKycVerified: true });
      kycRecord.status = KycStatus.APPROVED;
      await kycRecord.save();
      return true;
    }
  }
  return false;
};

export const getKycStatus = async (c: Context) => {
  const { userId } = c.req.valid('query' as never) as z.infer<typeof getKycStatusSchema>;

  const kycRecord = await KycRecord.findOne({ userId }).select('status shuftiVerificationResult');

  if (!kycRecord) {
    return c.json({ status: 'not_started', message: 'KYC verification has not been initiated.' });
  }

  return c.json({
    status: kycRecord.status,
    verificationDetails: kycRecord.shuftiVerificationResult,
  });
};

export const kycDocument = async (c: Context) => {
  const body = await c.req.parseBody({ all: true });
  const { userId } = c.req.valid('form' as never) as z.infer<typeof kycDocumentSchema>;
  const proof = body['proof'] as File;

  if (!proof) {
    return c.json({ error: 'Document proof is required' }, 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const imageBase64 = `data:${proof.type};base64,${arrayBufferToBase64(await proof.arrayBuffer())}`;

    await KycRecord.findOneAndUpdate(
      { userId },
      {
        documentProof: imageBase64,
        documentName: user.fullName,
        documentDob: user.dateOfBirth,
      },
      { upsert: true, new: true }
    );

    return c.json({ message: 'Document uploaded successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const kycFace = async (c: Context) => {
  const body = await c.req.parseBody({ all: true });
  const { userId } = c.req.valid('form' as never) as z.infer<typeof kycFaceSchema>;
  const proof = body['proof'] as File;

  if (!proof) {
    return c.json({ error: 'Face proof is required' }, 400);
  }

  try {
    const imageBase64 = `data:${proof.type};base64,${arrayBufferToBase64(await proof.arrayBuffer())}`;

    await KycRecord.findOneAndUpdate(
      { userId },
      { faceProof: imageBase64 },
      { upsert: true, new: true }
    );

    return c.json({ message: 'Face proof uploaded successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const kycAddress = async (c: Context) => {
  const { userId, fullAddress } = c.req.valid('json' as never) as z.infer<typeof kycAddressSchema>;

  // Check if User isn't verified yet, if verified don't allow to update address
  const user: IUser | null = await User.findById(userId);

  if (user?.isKycVerified) {
    return c.json({ error: 'User is already verified' }, 400);
  }

  try {
    await KycRecord.findOneAndUpdate(
      { userId },
      {
        fullAddress: fullAddress,
      },
      { upsert: true, new: true }
    );

    return c.json({ message: 'Address saved successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const kycConsent = async (c: Context) => {
  const body = await c.req.parseBody({ all: true });
  const { userId, text } = c.req.valid('form' as never) as z.infer<typeof kycConsentSchema>;
  const proof = body['proof'] as File;

  if (!proof) {
    return c.json({ error: 'Consent proof is required' }, 400);
  }

  try {
    const imageBase64 = `data:${proof.type};base64,${arrayBufferToBase64(await proof.arrayBuffer())}`;

    await KycRecord.findOneAndUpdate(
      { userId },
      {
        consentProof: imageBase64,
        consentText: text,
      },
      { upsert: true, new: true }
    );

    return c.json({ message: 'Consent proof uploaded successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const submitKyc = async (c: Context) => {
  const { userId } = c.req.valid('json' as never) as z.infer<typeof submitKycSchema>;

  const user = await User.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const kycRecord = await KycRecord.findOne({ userId });
  if (!kycRecord || !kycRecord.documentProof || !kycRecord.faceProof || !kycRecord.consentProof) {
    return c.json({ error: 'All KYC proofs must be uploaded before submission' }, 400);
  }

  try {
    const shuftiReferenceId = shuftiPro.generateReference();

    const dobParts = kycRecord.documentDob!.split('/');
    const dobForShufti = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;

    const nameParts = kycRecord.documentName!.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const payload: ShuftiVerifyPayload = {
      reference: shuftiReferenceId,
      document: {
        proof: kycRecord.documentProof,
        name: [firstName, lastName].filter(Boolean),
        dob: dobForShufti,
      },
      face: {
        proof: kycRecord.faceProof,
      },
      consent: {
        proof: kycRecord.consentProof,
        text: kycRecord.consentText,
      },
      background_checks: {
        name: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
        dob: dobForShufti,
      },
    };

    const response = await shuftiPro.verify(payload);

    kycRecord.shuftiReferenceId = shuftiReferenceId;
    kycRecord.shuftiEvent = response.event;
    kycRecord.shuftiVerificationResult = response;
    if (response.event === 'verification.declined') {
      kycRecord.status = KycStatus.REJECTED;
      kycRecord.rejectionReason = response.declined_reason;
    } else {
      kycRecord.status = KycStatus.PENDING; // Or whatever status shufti returns initially
    }
    await kycRecord.save();

    return c.json({ message: 'KYC submission successful', data: response });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const registerUser = async (c: Context) => {
  const { title, fullName, dateOfBirth, email, phone, password, referrer } = c.req.valid('json' as never) as z.infer<
    typeof registerUserSchema
  >;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
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
      referralId: nanoid(6)
    });

    if (referrer) {
      const referrerUser = await User.findOne({ referralId: referrer });
      if (referrerUser) {
        const existingReferral = await Referral.findOne({ user: referrerUser._id });

        if (existingReferral) {
          await Referral.findByIdAndUpdate(
            existingReferral._id,
            { $addToSet: { referredUsers: user._id } }
          );
        } else {
          await Referral.create({
            user: referrerUser._id,
            referredUsers: [user._id],
          });
        }
      }
    }

    const existingWallets = await Wallet.countDocuments({ userId: user._id });
    if (existingWallets === 0) {
      await initializeWalletSystem(user._id as string);
    } else {
      console.log(`Wallets already initialized for user ${user._id}. Skipping initialization.`);
    }

    const otpCode = await generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log('OTP Code:', otpCode);

    await Otp.findOneAndUpdate(
      { userId: user._id },
      { code: otpCode, expiresAt },
      { upsert: true, new: true }
    );

    sendEmail(user.email, '[LENDBLOCK] Email Verification OTP', otpVerificationEmail(otpCode, 10));

    return c.json({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    console.error('Error during user registration:', error);
    return c.json({ error: 'An unexpected error occurred during registration.' }, 500);
  }
};

export const verifyEmail = async (c: Context) => {
  const { userId, otp } = c.req.valid('json' as never) as z.infer<
    typeof verifyEmailSchema
  >;

  const user = await User.findOne({ _id: userId });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.isEmailVerified) {
    return c.json({ error: 'Email is already verified' }, 400);
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

  await Otp.deleteOne({ _id: storedOtp?._id });

  await User.findByIdAndUpdate(user._id, { isEmailVerified: true });

  return c.json({ message: 'Email verified successfully' }, 200);
}

export const sendPhone = async (c: Context) => {
  const { userId } = c.req.valid('json' as never) as z.infer<
    typeof requestPhoneOtpSchema
  >;

  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.isPhoneNumberVerified) {
    return c.json({ error: 'Phone number is already verified' }, 400);
  }

  const otpCode = await generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  console.log('OTP Code:', otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt, createdAt: new Date() },
    { upsert: true, new: true }
  );

  await sendSms(user.phoneNumber, `Your OTP is ${otpCode}. It expires in 10 minutes.`);

  return c.json({ message: 'An OTP has been sent to your phone number.' });
}

export const verifyPhone = async (c: Context) => {
  const { userId, otp } = c.req.valid('json' as never) as z.infer<
    typeof verifyPhoneSchema
  >;

  const user = await User.findById(userId);

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


export const editPhoneNumber = async (c: Context) => {
  const { userId, phone } = c.req.valid('json' as never) as z.infer<
    typeof editPhoneNumberSchema
  >;

  const user = await User.findOne({
    _id: userId,
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (user.isPhoneNumberVerified) {
    return c.json({ error: 'Phone number is already verified' }, 400);
  }

  await User.findByIdAndUpdate(user._id, { phoneNumber: phone });

  return c.json({ message: 'Phone number updated successfully' });
};

export const loginUser = async (c: Context) => {
  const { email, phone, password } = c.req.valid('json' as never) as z.infer<
    typeof loginUserSchema
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
    return c.json({ error: 'Invalid credentials' }, 401);
  }


  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (!user.isEmailVerified || !user.isPhoneNumberVerified) {
    return c.json({
      userId: user._id,
      error: 'User is not verified',
      verificationStatus: {
        email: user.isEmailVerified ? "verified" : "not verified",
        phone: user.isPhoneNumberVerified ? "verified" : "not verified"
      }
    }, 401);
  }


  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  console.log('OTP Code:', otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt },
    { upsert: true, new: true }
  );

  if (email) {
    sendEmail(user.email, '[LENDBLOCK] Login OTP', otpVerificationEmail(otpCode, 10));
  } else {
    await sendSms(user.phoneNumber, `Your OTP is ${otpCode}. It expires in 10 minutes.`);
  }


  return c.json({ message: 'An OTP has been sent to your email/phone.', userId: user.id });
};

export const verifyLogin = async (c: Context) => {
  const { userId, otp, clientDevice } = c.req.valid('json' as never) as z.infer<
    typeof verifyOtpSchema
  >;

  const user = await User.findOne({
    _id: userId,
  });

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
      { email },
      { phoneNumber: phone },
    ],
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  console.log("OTP Code: ", otpCode);

  await Otp.findOneAndUpdate(
    { userId: user._id },
    { code: otpCode, expiresAt },
    { upsert: true, new: true }
  );

  if (email) {
    sendEmail(user.email, '[LENDBLOCK] Password Reset Request', passwordResetRequestEmail(otpCode, 10));
  } else {
    await sendSms(user.phoneNumber, `Your OTP is ${otpCode}. It expires in 10 minutes.`);
  }

  return c.json({ message: 'Password reset requested. Check your email/phone for OTP.', userId: user._id });
};

export const validatePasswordResetOTP = async (c: Context) => {
  const { userId, otp } = c.req.valid('json' as never) as z.infer<
    typeof validatePasswordResetOTPSchema
  >;

  const user = await User.findOne({
    _id: userId,
  });

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

  await Otp.deleteOne({ _id: storedOtp._id });

  await User.findByIdAndUpdate(user._id, { allowPasswordReset: true });

  return c.json({ message: 'Password reset OTP validated successfully', userId: user._id });
};

export const setPassword = async (c: Context) => {
  const { userId, password } = c.req.valid('json' as never) as z.infer<
    typeof setPasswordSchema
  >;

  const user = await User.findOne({
    _id: userId,
  }).select('passwordHash allowPasswordReset');

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (!user.allowPasswordReset) {
    return c.json({ error: 'Password reset not allowed' }, 400);
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (passwordMatch) {
    return c.json({ error: "New password can't be the same as old password" }, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await User.findByIdAndUpdate(user._id, { passwordHash });

  await User.findByIdAndUpdate(user._id, { allowPasswordReset: false });

  return c.json({ message: 'Password set successfully' });
};

export const refreshToken = async (c: Context) => {
  const { refreshToken, clientDevice } = c.req.valid('json' as never) as z.infer<
    typeof refreshTokenSchema
  >;

  if (!refreshToken) {
    return c.json({ error: 'Refresh token is required' }, 400);
  }

  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded: any = await verify(refreshToken, secret);

    const storedRefreshToken = await RefreshToken.findOne({
      userId: decoded.userId,
      token: refreshToken,
      expiresAt: { $gt: new Date() },
    });

    if (!storedRefreshToken) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    await RefreshToken.deleteOne({ _id: storedRefreshToken._id });

    const newAccessToken = await sign({ userId: decoded.userId, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
    const newRefreshToken = await sign({ userId: decoded.userId, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

    await RefreshToken.create({
      userId: decoded.userId,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)), // 3 Days
    });

    if (clientDevice === "web") {
      setCookie(c, 'refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 60 * 60 * 24 * 3, // 3 days
      });

      return c.json({ accessToken: newAccessToken });
    }

    return c.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }
};

export const logout = async (c: Context) => {
  const { clientDevice } = c.req.valid('json' as never) as z.infer<
    typeof logoutSchema
  >;

  const jwtPayload = c.get('jwtPayload');

  if (!jwtPayload || !jwtPayload.userId) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    await RefreshToken.deleteMany({ userId: jwtPayload.userId });

    if (clientDevice === "web") {
      deleteCookie(c, 'refreshToken');
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    return c.json({ error: 'An unexpected error occurred during logout.' }, 500);
  }
};