import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Wallet from '../src/models/Wallet'
import UserBalance from '../src/models/UserBalance'

async function main() {
  try {
    await connectDB()

    const zeroOut = String(process.env.MIGRATE_ZERO_WALLET_BALANCES || 'false').toLowerCase() === 'true'

    const cursor = Wallet.find({ isLiquidityWallet: false }).cursor()
    let processed = 0, migrated = 0
    for await (const w of cursor as any) {
      processed++
      const bal = Number(w.balance || 0)
      if (bal > 0) {
        await UserBalance.findOneAndUpdate(
          { userId: w.userId, assetId: w.assetId },
          { $inc: { balance: bal } },
          { upsert: true, new: true }
        )
        migrated++
        if (zeroOut) {
          await Wallet.updateOne({ _id: w._id }, { $set: { balance: 0 } })
        }
      }
    }

    console.log(`Processed wallets: ${processed}. Migrated balances: ${migrated}. Zeroed wallets: ${zeroOut}`)
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
