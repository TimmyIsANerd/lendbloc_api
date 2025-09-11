import 'dotenv/config'
import mongoose from 'mongoose'
import { sign } from 'hono/jwt'

// Models
import User from '../src/models/User'
import Admin, { AdminRole } from '../src/models/Admin'
import Wallet from '../src/models/Wallet'
import Asset from '../src/models/Asset'
import Loan from '../src/models/Loan'
import SavingsAccount from '../src/models/SavingsAccount'
import Transaction from '../src/models/Transaction'
import Earning from '../src/models/Earning'
import Referral from '../src/models/Referral'
import Vote from '../src/models/Vote'
import Otp from '../src/models/Otp'
import RefreshToken from '../src/models/RefreshToken'
import AdminOtp from '../src/models/AdminOtp'
import AdminRefreshToken from '../src/models/AdminRefreshToken'
import AdminInvite from '../src/models/AdminInvite'
import KycRecord from '../src/models/KycRecord'
import SystemSetting from '../src/models/SystemSetting'
import Notification from '../src/models/Notification'

export async function connectTestDb() {
  const uri = process.env.MONGO_URI
  if (!uri) throw new Error('MONGO_URI is not set for tests')
  await mongoose.connect(uri)
}

export async function disconnectTestDb() {
  await mongoose.connection.close()
}

export async function clearDb() {
  const models = [
    User,
    Admin,
    Wallet,
    Asset,
    Loan,
    SavingsAccount,
    Transaction,
    Earning,
    Referral,
    Vote,
    Otp,
    RefreshToken,
    AdminOtp,
    AdminRefreshToken,
    AdminInvite,
    KycRecord,
    SystemSetting,
    Notification,
  ]
  for (const m of models) {
    try { await m.deleteMany({}) } catch {}
  }
}

export async function signUserToken(userId: string) {
  const secret = process.env.JWT_SECRET || 'test-secret'
  return await sign({ userId, exp: Math.floor(Date.now() / 1000) + 60 * 15 }, secret)
}

export async function signAdminToken(adminId: string, role: AdminRole = AdminRole.ADMIN) {
  const secret = process.env.JWT_SECRET || 'test-secret'
  return await sign({ adminId, role, exp: Math.floor(Date.now() / 1000) + 60 * 15 }, secret)
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function seedListedAsset(overrides?: Partial<Parameters<typeof Asset.create>[0]>) {
  const asset = await Asset.create({
    name: 'Bitcoin',
    symbol: 'BTC',
    iconUrl: 'https://example.com/btc.png',
    currentPrice: 50000,
    marketCap: 1000000000,
    circulatingSupply: 21000000,
    amountHeld: 0,
    isLendable: true,
    isCollateral: true,
    network: 'BTC',
    kind: 'native',
    status: 'LISTED',
    fees: {
      loanInterest: {
        REG: { d7: 3, d30: 4, d180: 5, d365: 6 },
        PRO: { d7: 2, d30: 3, d180: 4, d365: 5 },
      },
      savingsInterest: {
        REG: { d7: 1, d30: 2, d180: 3, d365: 4 },
        PRO: { d7: 1, d30: 2, d180: 3, d365: 4 },
      },
      sendFeePercent: { REG: 0.1, PRO: 0.08 },
      receiveFeePercent: { REG: 0.2, PRO: 0.15 },
      exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 },
      exchangeFeePercentTo: { REG: 0.3, PRO: 0.25 },
      referralFeePercent: { REG: 1, PRO: 1 },
    },
    ...overrides,
  } as any)
  return asset
}

