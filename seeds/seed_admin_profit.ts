import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import RevenueEvent from '../src/models/RevenueEvent'
import type { RevenueType } from '../src/models/RevenueEvent'
import { subDays, startOfDay, addHours } from 'date-fns'

async function main() {
  try {
    await connectDB()

    // Clean previously-seeded profit events to keep this idempotent
    const SEED_TAG = { network: 'SEED', symbol: 'SEED' }
    const removed = await RevenueEvent.deleteMany(SEED_TAG)
    if (removed.deletedCount) {
      console.log(`Removed ${removed.deletedCount} previously-seeded revenue events`)
    }

    const days = Number(process.env.PROFIT_SEED_DAYS || 60)

    const events: Array<{
      type: RevenueType
      amountUsd: number
      createdAt: Date
      network: string
      symbol: string
    }> = []

    for (let i = 0; i < days; i++) {
      const base = addHours(startOfDay(subDays(new Date(), i)), 12) // noon for readability

      // Daily baseline earnings
      events.push({ type: 'lending-interest', amountUsd: 8 + (i % 5), createdAt: base, network: 'SEED', symbol: 'SEED' })
      events.push({ type: 'interest-accrual', amountUsd: 5 + ((i + 2) % 4), createdAt: addHours(base, 1), network: 'SEED', symbol: 'SEED' })

      // Occasional transactional fees
      if (i % 2 === 0) {
        events.push({ type: 'swap-fee', amountUsd: 1.2 + ((i % 3) * 0.4), createdAt: addHours(base, 2), network: 'SEED', symbol: 'SEED' })
      }
      if (i % 3 === 0) {
        events.push({ type: 'deposit-fee', amountUsd: 2 + (i % 2), createdAt: addHours(base, 3), network: 'SEED', symbol: 'SEED' })
      }
      if (i % 4 === 0) {
        events.push({ type: 'withdrawal-fee', amountUsd: 1 + (i % 2), createdAt: addHours(base, 4), network: 'SEED', symbol: 'SEED' })
      }

      // Loan origination events sprinkled in
      if (i % 5 === 0) {
        events.push({ type: 'origination-fee', amountUsd: 12 + (i % 4), createdAt: addHours(base, 5), network: 'SEED', symbol: 'SEED' })
      }
    }

    if (events.length > 0) {
      await RevenueEvent.insertMany(events.map(e => ({
        type: e.type,
        amountUsd: Number(e.amountUsd.toFixed(2)),
        createdAt: e.createdAt,
        network: e.network,
        symbol: e.symbol,
      })))
    }

    console.log(`Seeded ${events.length} revenue events across ${days} days.`)
    console.log('Note: Run "bun run backfill:revenue" to build RevenueDaily rollups if not running automatically.')
  } catch (e) {
    console.error('Admin profit seeding failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()