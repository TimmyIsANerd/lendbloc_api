import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Asset from '../src/models/Asset'
import User, { AccountType } from '../src/models/User'
import SavingsAccount from '../src/models/SavingsAccount'
import SavingsEarning from '../src/models/SavingsEarning'
import bcrypt from 'bcrypt'

async function main() {
  try {
    await connectDB()

    // Create demo interest user
    let user = await User.findOne({ email: 'demo.interest@lendbloc.local' })
    if (!user) {
      const passwordHash = await bcrypt.hash('Demo@12345', 10)
      user = await User.create({
        fullName: 'Demo Interest',
        email: 'demo.interest@lendbloc.local',
        phoneNumber: '+15550002001',
        passwordHash,
        kycReferenceId: 'KYC-INTEREST',
        referralId: 'REF-INTEREST',
        isKycVerified: true,
        isEmailVerified: true,
        isPhoneNumberVerified: true,
        allowPasswordReset: true,
        allowEmailChange: true,
        accountType: AccountType.REG,
      } as any)
    }

    const ethAsset = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
    if (!ethAsset) throw new Error('ETH asset not found; seed assets first')

    // Savings account
    let sa = await SavingsAccount.findOne({ userId: user._id, assetId: ethAsset._id, status: 'ACTIVE' })
    if (!sa) {
      const now = new Date()
      const lockEndAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
      sa = await SavingsAccount.create({
        userId: user._id,
        assetId: ethAsset._id,
        balance: 1.0,
        apy: 4,
        termDays: 180,
        lockStartAt: now,
        lockEndAt,
        lastPayoutAt: now,
        status: 'ACTIVE',
      } as any)
    }

    // Seed earnings for last 12 months
    const base = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 15)
      const amount = 0.01 + (i % 3) * 0.005 // vary a bit
      await SavingsEarning.findOneAndUpdate(
        { userId: user._id, assetId: ethAsset._id, savingsAccountId: sa._id, accruedAt: d },
        { $setOnInsert: { amount, apy: 4, termDays: 30 } },
        { upsert: true }
      )
    }

    console.log('Seeded demo interest analytics user:', String(user._id))
  } catch (e) {
    console.error('Seed interest analytics user failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
