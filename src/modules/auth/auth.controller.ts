import { type Context } from 'hono';
import { z } from 'zod';
import User from '../../models/User';
import Otp from '../../models/Otp';
import RefreshToken from '../../models/RefreshToken';
import Wallet from '../../models/Wallet';
import Asset from '../../models/Asset';
import bcrypt from 'bcrypt';
import { sign, verify } from 'hono/jwt';
import { getCookie, setCookie } from 'hono/cookie';
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { HDNodeWallet } from 'ethers'; // Using ethers for HDNodeWallet as viem/accounts doesn't directly expose it
import TronWeb from 'tronweb';

import {
  registerUserSchema,
  loginUserSchema,
  verifyOtpSchema,
  requestPasswordResetSchema,
  setPasswordSchema,
} from './auth.validation';

// Placeholder for encryption/decryption functions. In a production environment,
// these should be replaced with a robust solution like AES-256-GCM and a proper KDF.
const encrypt = (text: string) => text; // TODO: Implement robust encryption
const decrypt = (text: string) => text; // TODO: Implement robust decryption

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

    // Generate a 12-word mnemonic phrase
    const mnemonic = generateMnemonic();
    const encryptedMnemonic = encrypt(mnemonic); // Encrypt the mnemonic

    // Derive master key from mnemonic
    const seed = await mnemonicToSeed(mnemonic);
    const hdNode = HDNodeWallet.fromSeed(seed);

    // Derive Ethereum address (EVM compatible)
    const ethWallet = hdNode.derivePath("m/44'/60'/0'/0/0");
    const ethAddress = ethWallet.address;

    // Derive Tron address
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io', // You might want to use a local node or a different provider in production
    });
    const tronWallet = tronWeb.fromMnemonic(mnemonic, "m/44'/195'/0'/0/0");
    const tronAddress = tronWallet.address.base58;

    // TODO: Implement Bitcoin address generation using a suitable library (e.g., bitcoinjs-lib)
    const btcAddress = `btc_address_placeholder_${socialIssuanceNumber}`;

    const user = await User.create({
      title,
      fullName,
      dateOfBirth,
      email,
      socialIssuanceNumber,
      phoneNumber: phone,
      passwordHash,
      isKycVerified: isProduction ? false : true,
      encryptedMnemonic,
    });

    // Create wallets for the user
    const ethAsset = await Asset.findOne({ symbol: 'ETH' });
    if (ethAsset) {
      await Wallet.create({
        userId: user._id,
        assetId: ethAsset._id,
        address: ethAddress,
        balance: 0,
      });
    } else {
      console.warn('ETH asset not found. Skipping ETH wallet creation.');
    }

    const tronAsset = await Asset.findOne({ symbol: 'TRX' });
    if (tronAsset) {
      await Wallet.create({
        userId: user._id,
        assetId: tronAsset._id,
        address: tronAddress,
        balance: 0,
      });
    } else {
      console.warn('TRX asset not found. Skipping TRX wallet creation.');
    }

    const btcAsset = await Asset.findOne({ symbol: 'BTC' });
    if (btcAsset) {
      await Wallet.create({
        userId: user._id,
        assetId: btcAsset._id,
        address: btcAddress,
        balance: 0,
      });
    } else {
      console.warn('BTC asset not found. Skipping BTC wallet creation.');
    }

    return c.json({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    console.error('Error during user registration:', error);
    return c.json({ error: 'An unexpected error occurred during registration.' }, 500);
  }
};

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