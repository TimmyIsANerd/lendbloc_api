import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import User from '../src/models/User'
import Asset from '../src/models/Asset'
import SavingsAccount from '../src/models/SavingsAccount'
import SavingsEarning from '../src/models/SavingsEarning'
import { addDays } from 'date-fns'

function round(n: number, dp = 8) {
  return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)
}

async function ensureUser(userId: string) {
  let user = await User.findById(userId)
  if (!user) {
    // Create a minimal user to enable seeding (required fields only)
    user = await User.create({
      _id: new mongoose.Types.ObjectId(userId),
      kycReferenceId: `SEED-KYC-${Math.random().toString(36).slice(2, 8)}`,
      referralId: `SEED-REF-${Math.random().toString(36).slice(2, 8)}`,
      isKycVerified: true,
      isEmailVerified: true,
      isPhoneNumberVerified: false,
    } as any)
  }
  return user
}

async function ensureAsset(symbol = 'BTC', network = 'BTC') {
  let asset = await Asset.findOne({ symbol, network })
  if (!asset) {
    asset = await Asset.create({
      name: symbol === 'BTC' ? 'Bitcoin' : symbol,
      symbol,
      iconUrl: 'https://example.com/icon.png',
      currentPrice: symbol === 'BTC' ? 50000 : 2000,
      marketCap: 1000000000,
      circulatingSupply: 21000000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network,
      kind: 'native',
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 3, d30: 4, d180: 5, d365: 6 },
          PRO: { d7: 2, d30: 3, d180: 4, d365: 5 },
        },
        savingsInterest: {
          REG: { d7: 1, d30: 6, d180: 8, d365: 10 },
          PRO: { d7: 1, d30: 6, d180: 8, d365: 10 },
        },
        sendFeePercent: { REG: 0.1, PRO: 0.08 },
        receiveFeePercent: { REG: 0.2, PRO: 0.15 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 },
        exchangeFeePercentTo: { REG: 0.3, PRO: 0.25 },
        referralFeePercent: { REG: 1, PRO: 1 },
      },
    } as any)
  }
  return asset
}

async function ensureSavingsAndSeed({
  userId,
  assetId,
  termDays = 30,
  cycles = 3,
  principal = 1.25,
  apy = 6,
}: {
  userId: string
  assetId: mongoose.Types.ObjectId
  termDays?: 7 | 30 | 180 | 365
  cycles?: number
  principal?: number
  apy?: number
}) {
  // Find existing savings for this user/asset (any status)
  let sa = await SavingsAccount.findOne({ userId, assetId }).sort({ createdAt: -1 })
  const now = new Date()

  const lockStartAt = addDays(now, -(cycles * termDays))
  const lockEndAt = addDays(lockStartAt, termDays)

  if (!sa) {
    sa = await SavingsAccount.create({
      userId,
      assetId,
      balance: principal,
      apy,
      termDays,
      lockStartAt,
      lockEndAt,
      lastPayoutAt: lockStartAt,
      status: 'ACTIVE',
    } as any)
  } else {
    // Reinitialize it for a clean demo
    sa.balance = principal
    sa.apy = apy
    sa.termDays = termDays as any
    sa.lockStartAt = lockStartAt as any
    sa.lockEndAt = lockEndAt as any
    ;(sa as any).lastPayoutAt = lockStartAt
    ;(sa as any).status = 'ACTIVE'
    await sa.save()
    // Remove previous earnings for clarity
    await SavingsEarning.deleteMany({ savingsAccountId: sa._id })
  }

  let runningBalance = sa.balance
  let last = lockStartAt
  for (let i = 0; i < cycles; i++) {
    const payoutDate = addDays(last, termDays)
    const cycleInterest = round(runningBalance * (apy / 100) * (termDays / 365))
    if (cycleInterest > 0) {
      runningBalance += cycleInterest
      await SavingsEarning.create({
        userId: sa.userId,
        assetId: sa.assetId,
        savingsAccountId: sa._id,
        amount: cycleInterest,
        apy: sa.apy,
        termDays: sa.termDays,
        accruedAt: payoutDate,
      })
    }
    last = payoutDate
  }

  sa.balance = runningBalance
  ;(sa as any).lastPayoutAt = last
  await sa.save()

  return sa
}

async function main() {
  const userId = process.env.USER_ID || '68c25a5d82ad86689ed462f0'
  const termDays = Number(process.env.TERM_DAYS || 30) as 7 | 30 | 180 | 365
  const cycles = Number(process.env.CYCLES || 3)
  const apy = Number(process.env.APY || 6)
  const principal = Number(process.env.PRINCIPAL || 1.25)
  const symbol = process.env.SYMBOL || 'BTC'
  const network = process.env.NETWORK || 'BTC'

  try {
    await connectDB()

    const user = await ensureUser(userId)
    const asset = await ensureAsset(symbol, network)

    const sa = await ensureSavingsAndSeed({
      userId: String(user._id),
      assetId: asset._id as any,
      termDays,
      cycles,
      principal,
      apy,
    })

    console.log('Seeded savings history:')
    console.log('  userId:', String(user._id))
    console.log('  assetId:', String(asset._id), 'symbol:', asset.symbol, 'network:', asset.network)
    console.log('  savingsAccountId:', String(sa._id))
    console.log('  balance:', sa.balance)
    console.log('  apy:', sa.apy, 'termDays:', sa.termDays)
    console.log('  lastPayoutAt:', sa.lastPayoutAt)
  } catch (e) {
    console.error('Seeding failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
