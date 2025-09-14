import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Asset from '../src/models/Asset'
import User from '../src/models/User'
import SavingsAccount from '../src/models/SavingsAccount'
import SavingsEarning from '../src/models/SavingsEarning'

const USERS = [
  'demo-a@lendbloc.local',
  'demo-b@lendbloc.local',
  'demo-c@lendbloc.local',
  'demo.interest@lendbloc.local',
]

async function ensureEarnings(userId: any, assetId: any, saId: any) {
  const base = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 15)
    const amount = 0.005 + (i % 4) * 0.002
    await SavingsEarning.findOneAndUpdate(
      { userId, assetId, savingsAccountId: saId, accruedAt: d },
      { $setOnInsert: { amount, apy: 4, termDays: 30 } },
      { upsert: true }
    )
  }
}

async function main() {
  try {
    await connectDB()
    const eth = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
    if (!eth) throw new Error('ETH asset missing')

    for (const email of USERS) {
      const user = await User.findOne({ email })
      if (!user) continue
      const now = new Date()
      const sa = await SavingsAccount.findOneAndUpdate(
        { userId: user._id, assetId: eth._id, status: 'ACTIVE' },
        { $setOnInsert: { balance: 0.1, apy: 4, termDays: 30, lockStartAt: now, lockEndAt: new Date(now.getTime() + 30*24*60*60*1000), lastPayoutAt: now, status: 'ACTIVE' } },
        { upsert: true, new: true }
      )
      await ensureEarnings(user._id, eth._id, sa!._id)
    }

    console.log('Seeded interest earnings for all demo users')
  } catch (e) {
    console.error('Seed interest all users failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
