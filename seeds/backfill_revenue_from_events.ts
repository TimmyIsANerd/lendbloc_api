import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import RevenueEvent from '../src/models/RevenueEvent'
import RevenueDaily from '../src/models/RevenueDaily'
import { startOfDay, format } from 'date-fns'

async function main() {
  try {
    await connectDB()

    const cursor = RevenueEvent.find({}).cursor()
    const byDayTotal: Record<string, number> = {}
    const byDayType: Record<string, Record<string, number>> = {}

    for await (const ev of cursor as any) {
      const dStr = format(startOfDay(new Date(ev.createdAt)), 'yyyy-MM-dd')
      byDayTotal[dStr] = (byDayTotal[dStr] || 0) + Number(ev.amountUsd || 0)
      if (!byDayType[dStr]) byDayType[dStr] = {}
      const k = ev.type as string
      byDayType[dStr][k] = (byDayType[dStr][k] || 0) + Number(ev.amountUsd || 0)
    }

    for (const [dateStr, totalUsd] of Object.entries(byDayTotal)) {
      await RevenueDaily.findOneAndUpdate(
        { dateStr },
        { $set: { totalUsd, byType: byDayType[dateStr] || {} } },
        { upsert: true }
      )
    }

    console.log('Backfilled RevenueDaily from RevenueEvent:', Object.keys(byDayTotal).length, 'days')
  } catch (e) {
    console.error('Backfill revenue failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()