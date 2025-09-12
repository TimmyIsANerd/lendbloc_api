import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import User from '../src/models/User'
import { ensureUserTopBalances } from '../src/helpers/balances/ensure'

async function main() {
  try {
    await connectDB()

    const userEmail = process.env.SEED_USER_EMAIL
    if (userEmail) {
      const user = await User.findOne({ email: userEmail })
      if (!user) {
        console.log('User not found for email:', userEmail)
        process.exit(1)
      }
      const res = await ensureUserTopBalances(String(user._id), Number(process.env.TOP_ASSETS_LIMIT || '20'))
      console.log(`Ensured top balances for ${user.email}: created=${res.created} total=${res.total}`)
      return
    }

    // All users
    const users = await User.find({}).select('_id email')
    let totalCreated = 0
    for (const u of users) {
      const res = await ensureUserTopBalances(String(u._id), Number(process.env.TOP_ASSETS_LIMIT || '20'))
      totalCreated += res.created
      console.log(`User ${u.email || u._id}: created=${res.created}/${res.total}`)
    }
    console.log(`Done. Total upserts: ${totalCreated}`)
  } catch (e) {
    console.error('seed_user_top_balances failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
