import 'dotenv/config'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid'
import connectDB from '../src/config/db'
import User, { AccountType } from '../src/models/User'
import Asset from '../src/models/Asset'
import UserBalance from '../src/models/UserBalance'

async function main() {
  try {
    await connectDB()

    const email = process.env.SEED_USER_EMAIL || 'balances.user@lendbloc.local'
    const accountType = (process.env.SEED_USER_ACCTYPE as AccountType) || AccountType.REG
    const phone = process.env.SEED_USER_PHONE || `+1555${Math.floor(1000000 + Math.random() * 9000000)}`

    // Create or fetch user
    let user = await User.findOne({ email })
    if (!user) {
      user = await User.create({
        email,
        phoneNumber: phone,
        kycReferenceId: nanoid(),
        referralId: nanoid(6),
        isKycVerified: true,
        isEmailVerified: true,
        isPhoneNumberVerified: false,
        allowPasswordReset: true,
        allowEmailChange: true,
        accountType,
      } as any)
      console.log(`Created user: ${email}`)
    } else {
      console.log(`User exists: ${email}`)
    }

    const assets = await Asset.find({ status: 'LISTED' }).select('_id symbol network').limit(10)
    if (assets.length === 0) {
      console.log('No LISTED assets found. Please seed assets first.')
      return
    }

    const exampleAmounts: Record<string, number> = {
      BTC: 0.05,
      ETH: 0.75,
      LTC: 12,
      TRX: 1500,
      USDT: 300,
      BNB: 2,
    }

    let created = 0, updated = 0
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i]
      const amt = exampleAmounts[a.symbol] ?? Math.max(1, Math.round((i + 1) * 3.5))
      const existing = await UserBalance.findOne({ userId: user._id, assetId: a._id })
      if (existing) {
        await UserBalance.updateOne({ _id: existing._id }, { $set: { balance: amt } })
        updated++
      } else {
        await UserBalance.create({ userId: user._id, assetId: a._id, balance: amt, locked: 0 })
        created++
      }
    }

    console.log(`Balances seeded for ${email}. Created: ${created}, Updated: ${updated}`)
    console.log(`User ID: ${user._id}`)
    console.log('Login flow (DEV): POST /api/v1/auth/otp/start with { "email": "', email, '" } then /otp/verify (bypassed in DEV).')
  } catch (e) {
    console.error('Seed user balances failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
