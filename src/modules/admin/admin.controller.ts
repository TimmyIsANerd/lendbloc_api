import { type Context } from 'hono';
import User, { AccountStatus } from '../../models/User';
import Loan from '../../models/Loan';
import SavingsAccount from '../../models/SavingsAccount';
import Transaction from '../../models/Transaction';
import Admin from '../../models/Admin';
import AdminOtp from '../../models/AdminOtp';
import Wallet from '../../models/Wallet';
import AdminRefreshToken from '../../models/AdminRefreshToken';
import RefreshToken from '../../models/RefreshToken';
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
  adminLogoutSchema,
  adminRefreshTokenSchema,
  adminBlockUserSchema,
  adminUnblockUserSchema,
  adminListBlockedUsersSchema,
  adminListKycSchema,
  adminInviteSchema
} from './admin.validation';
import { sendSms } from '../../helpers/twilio';
import { sendEmail } from '../../helpers/email';
import { otpVerificationEmail } from '../../templates/otp-verification';
import KycRecord from '../../models/KycRecord';
import { initializeLiquidityWalletSystem } from '../../helpers/wallet';
import { verify } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import AdminInvite from '../../models/AdminInvite';
import { adminInviteEmail } from '../../templates/admin-invite';
import { nanoid } from 'nanoid';
import SystemSetting from '../../models/SystemSetting';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

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

export const inviteAdmin = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const inviterId = jwtPayload?.adminId;

  if (!inviterId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, role } = c.req.valid('json' as never) as z.infer<typeof adminInviteSchema>;

  try {
    const existing = await Admin.findOne({ email });
    if (existing) {
      return c.json({ error: 'Admin with this email already exists' }, 409);
    }

    const token = nanoid(40);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const invite = await AdminInvite.create({
      email,
      role,
      token,
      expiresAt,
      invitedBy: inviterId,
    });

    const inviter = await Admin.findById(inviterId).select('fullName');

    await sendEmail(email, '[LENDBLOC] Admin Invitation', adminInviteEmail(inviter?.fullName || 'An Admin', token));

    return c.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error creating admin invite:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const listKycUsers = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { page, limit } = c.req.valid('query' as never) as z.infer<typeof adminListKycSchema>;
  const pageNum = page ?? 1;
  const limitNum = limit ?? 20;
  const skip = (pageNum - 1) * limitNum;

  try {
    const [records, total] = await Promise.all([
      KycRecord.find()
        .select('userId status documentProof faceProof consentProof createdAt')
        .populate({ path: 'userId', select: 'email createdAt' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      KycRecord.countDocuments({})
    ]);

    const data = records.map((rec: any) => {
      const user = rec.userId as { email?: string; createdAt?: Date } | null;
      return {
        email: user?.email ?? null,
        registrationDate: user?.createdAt ? formatDisplayDate(user.createdAt) : null,
        documents: {
          faceProof: rec.faceProof ?? null,
          documentProof: rec.documentProof ?? null,
          consentProof: rec.consentProof ?? null,
        },
        status: rec.status,
      };
    });

    return c.json({
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error listing KYC users:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

const formatDisplayDate = (date: Date | string | number) => {
  const d = new Date(date);
  const month = d.toLocaleString('en-US', { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month} ${day}, ${year} | ${hours}:${minutes}`;
};

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
      isEmailVerified: TEST_ENV ? true : false,
      isPhoneNumberVerified: TEST_ENV ? true : false,
    });

    const { passwordHash: _, ...adminData } = newAdmin.toObject();

    // Check if Liquidity wallet already exists
    const existingLiquidityWallet = await Wallet.findOne({ userId: newAdmin._id, isLiquidityWallet: true });
    if (!existingLiquidityWallet) {
      await initializeLiquidityWalletSystem(newAdmin._id as string);
    }

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

    return c.json({ message: 'OTP sent successfully', userId: admin._id });
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

    if (!TEST_ENV) {
      const otpRecord = await AdminOtp.findOne({ userId, code: otp });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return c.json({ error: 'Invalid or expired OTP' }, 400);
      }

      await AdminOtp.deleteOne({ _id: otpRecord._id });
    }

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

    if (!TEST_ENV) {
      const otp = generateOtp(5);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await AdminOtp.findOneAndUpdate(
        { userId: admin._id },
        { code: otp, expiresAt },
        { upsert: true, new: true }
      );

      await sendEmail(admin.email, 'LendBloc Admin Login Verification', otpVerificationEmail(otp, 10));

      return c.json({ message: 'OTP sent for login verification', userId: admin._id });
    }

    // Development mode: bypass OTP and issue tokens immediately
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const accessToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
    const refreshToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

    await AdminRefreshToken.create({
      userId: admin._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)),
    });

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 3, // 3 days
    });

    return c.json({ accessToken });
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

    if (!TEST_ENV) {
      const otpRecord = await AdminOtp.findOne({ userId, code: otp });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return c.json({ error: 'Invalid or expired OTP' }, 400);
      }

      await AdminOtp.deleteOne({ _id: otpRecord._id });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const accessToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
    const refreshToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

    await AdminRefreshToken.create({
      userId: admin._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 3)),
    });

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 3, // 3 days
    });

    return c.json({ accessToken });
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

export const adminRefreshToken = async (c: Context) => {
  const { refreshToken } = c.req.valid('json' as never) as z.infer<typeof adminRefreshTokenSchema>;

  try {
    if (!refreshToken) {
      return c.json({ error: 'Refresh token is required' }, 400);
    }

    const existingRefreshToken = await AdminRefreshToken.findOne({ token: refreshToken });

    if (!existingRefreshToken) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;
    try {
      decoded = await verify(refreshToken, secret);
    } catch (error) {
      await AdminRefreshToken.deleteOne({ token: refreshToken });
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404);
    }

    const newAccessToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 15) }, secret);
    const newRefreshToken = await sign({ adminId: admin._id, role: admin.role, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, secret);

    existingRefreshToken.token = newRefreshToken;
    existingRefreshToken.expiresAt = new Date(Date.now() + (1000 * 60 * 60 * 24 * 3));
    await existingRefreshToken.save();

    setCookie(c, 'refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 3, // 3 days
    });

    return c.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error refreshing admin token:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getAdminProfile = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const admin = await Admin.findById(adminId).select('-passwordHash');
    if (!admin) {
      return c.json({ error: 'Admin not found' }, 404);
    }
    return c.json(admin);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const uploadAdminAvatar = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.parseBody({ all: true });
    const file = body['avatar'] as unknown;

    if (!(file instanceof File)) {
      return c.json({ error: 'Avatar file is required (multipart/form-data with field name "avatar")' }, 400);
    }

    const image = file as File;

    // Enforce image MIME type
    if (!image.type || !image.type.startsWith('image/')) {
      return c.json({ error: 'Only image files are allowed' }, 400);
    }

    // Enforce max size 3MB
    const MAX_SIZE = 3 * 1024 * 1024;
    if ((image as any).size > MAX_SIZE) {
      return c.json({ error: 'File size exceeds 3MB limit' }, 400);
    }

    const dataUrl = `data:${image.type};base64,${arrayBufferToBase64(await image.arrayBuffer())}`;

    await Admin.findByIdAndUpdate(adminId, { avatar: dataUrl });

    return c.json({ message: 'Avatar uploaded successfully' });
  } catch (error) {
    console.error('Error uploading admin avatar:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const deleteAdminAvatar = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await Admin.findByIdAndUpdate(adminId, { $unset: { avatar: 1 } });
    return c.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Error deleting admin avatar:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminBlockUser = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, phone } = c.req.valid('json' as never) as z.infer<typeof adminBlockUserSchema>;

  try {
    const admin = await Admin.findById(adminId).select('fullName');
    if (!admin) return c.json({ error: 'Admin not found' }, 404);

    const query = email ? { email } : { phoneNumber: phone };

    const user = await User.findOneAndUpdate(
      query,
      { $set: { accountStatus: AccountStatus.BLOCKED, blockedAt: new Date(), blockedByAdminName: admin.fullName } },
      { new: true }
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // End current login session by deleting all refresh tokens for the user
    await RefreshToken.deleteMany({ userId: user._id });

    return c.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Error blocking user:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminUnblockUser = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { email, phone } = c.req.valid('json' as never) as z.infer<typeof adminUnblockUserSchema>;

  try {
    const query = email ? { email } : { phoneNumber: phone };

    const user = await User.findOneAndUpdate(
      query,
      { $set: { accountStatus: AccountStatus.ACTIVE }, $unset: { blockedAt: 1, blockedByAdminName: 1 } },
      { new: true }
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const listBlockedUsers = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { page, limit } = c.req.valid('query' as never) as z.infer<typeof adminListBlockedUsersSchema>;

  const pageNum = page ?? 1;
  const limitNum = limit ?? 20;
  const skip = (pageNum - 1) * limitNum;

  try {
    const [items, total] = await Promise.all([
      User.find({ accountStatus: AccountStatus.BLOCKED })
        .select('email blockedAt blockedByAdminName')
        .sort({ blockedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments({ accountStatus: AccountStatus.BLOCKED })
    ]);

    const data = items.map((u: any) => ({
      email: u.email,
      blockedAt: u.blockedAt ? formatDisplayDate(u.blockedAt) : null,
      blockedByAdminName: u.blockedByAdminName ?? null,
    }));

    return c.json({
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error listing blocked users:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getSystemSettings = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    let settings = await SystemSetting.findOne({ key: 'GLOBAL' }).select('savingsApy createdAt updatedAt');
    if (!settings) {
      settings = await SystemSetting.create({ savingsApy: 0 });
    }

    return c.json({
      savingsApy: settings.savingsApy,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const adminUpdateSavingsApy = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const adminId = jwtPayload?.adminId;

  if (!adminId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { savingsApy } = c.req.valid('json' as never) as { savingsApy: number };

  try {
    const settings = await SystemSetting.findOneAndUpdate(
      { key: 'GLOBAL' },
      { $set: { savingsApy } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).select('savingsApy createdAt updatedAt');

    return c.json({ message: 'Savings APY updated successfully', savingsApy: settings!.savingsApy });
  } catch (error) {
    console.error('Error updating savings APY:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
