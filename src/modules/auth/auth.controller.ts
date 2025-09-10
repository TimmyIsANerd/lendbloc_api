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
import { encryptSecret } from '../../helpers/crypto';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

import {
  otpStartSchema,
  otpVerifySchema,
  requestPhoneOtpSchema,
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
  editPhoneNumberSchema,
  kycBioSchema
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

// Remove data URL prefix if present to keep payloads compact and provider-friendly
const stripDataUrl = (input: string) => input.replace(/^data:[^;]+;base64,/, '');

const
  checkKycStatus = async (userId: string) => {
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

  let kycRecord = await KycRecord.findOne({ userId }).select('status shuftiVerificationResult shuftiReferenceId');

  if (!kycRecord) {
    return c.json({ status: 'not_started', message: 'KYC verification has not been initiated.' });
  }

  // If a Shufti Pro reference ID exists, fetch the latest status
  if (kycRecord.shuftiReferenceId) {
    try {
      const shuftiStatus = await shuftiPro.getStatus(kycRecord.shuftiReferenceId);

      console.log('Shufti Pro Status:', shuftiStatus);

      // Update kycRecord with the latest status from Shufti Pro
      kycRecord.shuftiVerificationResult = shuftiStatus;
      if (shuftiStatus.event === 'verification.declined') {
        kycRecord.status = KycStatus.REJECTED;
        kycRecord.rejectionReason = shuftiStatus.declined_reason;
      } else if (shuftiStatus.event === 'verification.accepted') {
        kycRecord.status = KycStatus.APPROVED;
        // Also update user's isKycVerified status if fully accepted
        await User.findByIdAndUpdate(userId, { isKycVerified: true });
      } else {
        kycRecord.status = KycStatus.PENDING; // Or other relevant status from Shufti Pro
      }
      await kycRecord.save();

    } catch (error: any) {
      console.error('Error fetching Shufti Pro status:', error);
      const msg = (error as Error)?.message ?? '';
      // If provider says reference is invalid, re-submit with the SAME reference to ensure acknowledgment
      if (/invalid/i.test(msg) && /reference/i.test(msg)) {
        try {
          // Rebuild the payload from stored proofs
          const dobParts = (kycRecord.documentDob || '').split('/');
          const dobForShufti = dobParts.length === 3 ? `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}` : '';
          const nameParts = (kycRecord.documentName || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          const payload: ShuftiVerifyPayload = {
            reference: kycRecord.shuftiReferenceId,
            document: kycRecord.documentProof ? {
              proof: stripDataUrl(kycRecord.documentProof),
              name: [firstName, lastName].filter((n): n is string => Boolean(n)),
              dob: dobForShufti,
            } : undefined,
            face: kycRecord.faceProof ? {
              proof: stripDataUrl(kycRecord.faceProof),
            } : undefined,
            consent: kycRecord.consentProof ? {
              proof: stripDataUrl(kycRecord.consentProof),
              text: `${kycRecord.documentName || ''} dob:${dobForShufti}`,
            } : undefined,
            background_checks: dobForShufti ? {
              name: {
                first_name: firstName,
                last_name: lastName,
              },
              dob: dobForShufti,
            } : undefined,
          };

          const response = await shuftiPro.verify(payload);
          kycRecord.shuftiEvent = response.event;
          kycRecord.shuftiVerificationResult = response;
          if (response.event === 'verification.declined') {
            kycRecord.status = KycStatus.REJECTED;
            kycRecord.rejectionReason = response.declined_reason;
          } else {
            kycRecord.status = KycStatus.PENDING;
          }
          await kycRecord.save();
        } catch (reErr) {
          console.error('Re-submit with same reference failed:', reErr);
          // Keep as pending; client can retry status later
          kycRecord.status = KycStatus.PENDING;
          await kycRecord.save();
        }
      }
    }
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

export const kycBio = async (c: Context) => {
  const { userId, title, fullName, dateOfBirth, email, socialIssuanceNumber, password } = c.req.valid('json' as never) as z.infer<typeof kycBioSchema>;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Ensure email uniqueness
    const existingEmailOwner = await User.findOne({ email });
    if (existingEmailOwner && String(existingEmailOwner._id) !== String(user._id)) {
      return c.json({ error: 'Email already in use' }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await User.findByIdAndUpdate(user._id, {
      title,
      fullName,
      dateOfBirth,
      email,
      passwordHash,
    } as Partial<IUser>);

    const encryptedSin = encryptSecret(socialIssuanceNumber);
    await KycRecord.findOneAndUpdate(
      { userId: user._id },
      {
        documentName: fullName,
        documentDob: dateOfBirth,
        socialIssuanceNumberEncrypted: encryptedSin,
      },
      { upsert: true, new: true }
    );

    return c.json({ message: 'Bio data saved successfully' });
  } catch (error) {
    console.error('Error saving KYC bio:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
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

  // Check if User isn't already verified
  if (user.isKycVerified) {
    return c.json({ error: 'User is already verified' }, 400);
  }

  const kycRecord = await KycRecord.findOne({ userId });
  if (!kycRecord || !kycRecord.documentProof || !kycRecord.faceProof || !kycRecord.consentProof) {
    return c.json({ error: 'All KYC proofs must be uploaded before submission' }, 400);
  }

  try {
    const shuftiReferenceId = shuftiPro.generateReference();

    // Persist the generated reference and mark as pending BEFORE contacting the provider
    kycRecord.shuftiReferenceId = shuftiReferenceId;
    kycRecord.status = KycStatus.PENDING;
    await kycRecord.save();

    const dobParts = kycRecord.documentDob!.split('/');
    const dobForShufti = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;

    const nameParts = kycRecord.documentName!.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const payload: ShuftiVerifyPayload = {
      reference: shuftiReferenceId,
      document: {
        proof: stripDataUrl(kycRecord.documentProof!),
        name: [firstName, lastName].filter((n): n is string => Boolean(n)),
        dob: dobForShufti,
      },
      face: {
        proof: stripDataUrl(kycRecord.faceProof!),
      },
      consent: {
        proof: stripDataUrl(kycRecord.consentProof!),
        text: `${kycRecord.documentName!} dob:${dobForShufti}`,
      },
      background_checks: {
        name: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
        dob: dobForShufti,
      },
    };

    try {
      const response = await shuftiPro.verify(payload);

      kycRecord.shuftiEvent = response.event;
      kycRecord.shuftiVerificationResult = response;
      if (response.event === 'verification.declined') {
        kycRecord.status = KycStatus.REJECTED;
        kycRecord.rejectionReason = response.declined_reason;
      } else {
        kycRecord.status = KycStatus.PENDING;
      }
      await kycRecord.save();

      return c.json({ message: 'KYC submission successful', reference: shuftiReferenceId, data: response });
    } catch (error: any) {
      // Keep status pending; provider may have accepted while our client timed out
      kycRecord.status = KycStatus.PENDING;
      kycRecord.rejectionReason = error.message;
      await kycRecord.save();
      return c.json({ message: 'KYC submission pending', reference: shuftiReferenceId }, 202);
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
};

export const otpStart = async (c: Context) => {
  const { email, phone, referrer } = c.req.valid('json' as never) as z.infer<typeof otpStartSchema>;

  try {
    const query: any = email ? { email } : { phoneNumber: phone };
    let user = await User.findOne(query);

    if (!user) {
      // Create minimal user record
      user = await User.create({
        email: email ?? undefined,
        phoneNumber: phone ?? undefined,
        kycReferenceId: nanoid(),
        referralId: nanoid(6),
      } as Partial<IUser>);

      // Handle referral linkage
      if (referrer) {
        const referrerUser = await User.findOne({ referralId: referrer });
        if (referrerUser) {
          const existingReferral = await Referral.findOne({ user: referrerUser._id });
          if (existingReferral) {
            await Referral.findByIdAndUpdate(existingReferral._id, { $addToSet: { referredUsers: user._id } });
          } else {
            await Referral.create({ user: referrerUser._id, referredUsers: [user._id] });
          }
        }
      }
    }

    if (!TEST_ENV) {
      const otpCode = generateOtp(6);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await Otp.findOneAndUpdate(
        { userId: user._id },
        { code: otpCode, expiresAt, createdAt: new Date() },
        { upsert: true, new: true }
      );

      if (email) {
        await sendEmail(user.email!, '[LENDBLOC] Login OTP', otpVerificationEmail(otpCode, 10));
      } else if (phone) {
        await sendSms(user.phoneNumber!, `Your OTP is ${otpCode}. It expires in 10 minutes.`);
      }
    }

    return c.json({ message: TEST_ENV ? 'Development mode: OTP step is bypassed' : 'An OTP has been sent to your email/phone.', userId: user._id });
  } catch (error) {
    console.error('Error starting OTP auth:', error);
    return c.json({ error: 'An unexpected error occurred starting OTP auth.' }, 500);
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

  await sendSms(user.phoneNumber as string, `Your OTP is ${otpCode}. It expires in 10 minutes.`);

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

// Removed password-based login in favor of OTP-only flow

export const otpVerify = async (c: Context) => {
  const { userId, otp, clientDevice } = c.req.valid('json' as never) as z.infer<typeof otpVerifySchema>;

  const user = await User.findById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (!TEST_ENV) {
    const storedOtp = await Otp.findOne({ userId: user._id });
    if (!storedOtp || storedOtp.code !== otp || storedOtp.expiresAt < new Date()) {
      if (storedOtp && storedOtp.expiresAt < new Date()) {
        await Otp.deleteOne({ _id: storedOtp._id });
      }
      return c.json({ error: 'Invalid or expired OTP' }, 400);
    }
    await Otp.deleteOne({ _id: storedOtp._id });
  }

  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const accessToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + 60 * 15 }, secret);
  const refreshToken = await sign({ userId: user._id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, secret);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days
  });

  // Initialize wallets after first successful OTP verification
  const existingWallets = await Wallet.countDocuments({ userId: user._id });
  if (existingWallets === 0) {
    try {
      await initializeWalletSystem(user._id as string);
    } catch (e) {
      console.error('Failed to initialize wallets:', e);
      // Continue auth even if wallet init fails; can be retried later
    }
  }

  if (clientDevice === 'mobile') {
    return c.json({ accessToken, refreshToken });
  }

  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: !TEST_ENV,
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 3,
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
    sendEmail(user.email as string, '[LENDBLOCK] Password Reset Request', passwordResetRequestEmail(otpCode, 10));
  } else {
    await sendSms(user.phoneNumber as string, `Your OTP is ${otpCode}. It expires in 10 minutes.`);
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

  const passwordMatch = await bcrypt.compare(password, user.passwordHash as string);

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
        secure: !TEST_ENV,
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