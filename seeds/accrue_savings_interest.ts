import 'dotenv/config'
import mongoose from 'mongoose'
import { addDays, differenceInDays } from 'date-fns'
import connectDB from '../src/config/db'
import SavingsAccount from '../src/models/SavingsAccount'
import SavingsEarning from '../src/models/SavingsEarning'

function round(n: number, dp = 8) { return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp) }

async function main() {
  try {
    await connectDB()

    const now = new Date()
    let accounts = await SavingsAccount.find({ status: 'ACTIVE' })
    let payoutAccounts = 0, payoutTotal = 0

    for (const sa of accounts) {
      let last = sa.lastPayoutAt ? new Date(sa.lastPayoutAt) : (sa.lockStartAt ? new Date(sa.lockStartAt) : new Date(sa.createdAt))
      let applied = 0

      // Apply payouts on completed term cycles (7/30/180/365 days); catch up multiple cycles if needed
      const cycleDays = Number(sa.termDays) || 30
      while (differenceInDays(now, last) >= cycleDays) {
        const payoutDate = addDays(last, cycleDays)
        // Interest for this completed cycle proportionate to cycleDays/365, compounded
        const cycleInterest = round(sa.balance * (sa.apy / 100) * (cycleDays / 365))
        if (cycleInterest > 0) {
          sa.balance += cycleInterest
          await SavingsEarning.create({
            userId: sa.userId,
            assetId: sa.assetId,
            savingsAccountId: sa._id,
            amount: cycleInterest,
            apy: sa.apy,
            termDays: sa.termDays,
            accruedAt: payoutDate,
          })
          applied += cycleInterest
        }
        last = payoutDate
      }

      if (applied > 0) {
        sa.lastPayoutAt = last
        await sa.save()
        payoutAccounts++
        payoutTotal += applied
      }
    }

    console.log(`Term-cycle accrual: accountsPaid=${payoutAccounts}, totalInterest=${payoutTotal}`)
  } catch (e) {
    console.error('Accrual job failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
