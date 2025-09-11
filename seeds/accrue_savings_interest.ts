import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import SavingsAccount from '../src/models/SavingsAccount'
import SavingsEarning from '../src/models/SavingsEarning'

function round(n: number, dp = 8) { return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp) }

async function main() {
  try {
    await connectDB()

    const now = new Date()
    let accounts = await SavingsAccount.find({})
    let count = 0, total = 0

    for (const sa of accounts) {
      const daily = round((sa.balance * (sa.apy / 100)) / 365)
      if (daily <= 0) continue
      sa.balance += daily
      await sa.save()
      await SavingsEarning.create({
        userId: sa.userId,
        assetId: sa.assetId,
        savingsAccountId: sa._id,
        amount: daily,
        apy: sa.apy,
        termDays: sa.termDays,
        accruedAt: now,
      })
      count++
      total += daily
    }

    console.log(`Accrued interest: accounts=${count}, total=${total}`)
  } catch (e) {
    console.error('Accrual job failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
