import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import User, { AccountType } from '../src/models/User'
import Asset from '../src/models/Asset'
import Loan from '../src/models/Loan'
import UserBalance from '../src/models/UserBalance'
import Transaction from '../src/models/Transaction'

async function getOrCreateTestUser() {
  // Prefer an existing seeded user
  let user = await User.findOne({ email: 'john@example.com' })
  if (user) return user

  // Create a minimal test user (email optional; required unique fields: kycReferenceId, referralId)
  const uid = Math.random().toString(36).slice(2, 10).toUpperCase()
  user = await User.create({
    fullName: 'Loan Tester',
    email: `loan.tester.${uid}@example.com`,
    kycReferenceId: `KYC-TEST-${uid}`,
    referralId: `REF-TEST-${uid}`,
    isKycVerified: true,
    isEmailVerified: true,
    accountType: AccountType.REG,
  } as any)
  return user
}

async function pickAssets() {
  let borrow = await Asset.findOne({ symbol: 'USDT', network: 'ETH' })
  let borrowNetwork: 'ETH' | 'TRON' = 'ETH'
  if (!borrow) {
    borrow = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
    borrowNetwork = 'ETH'
  }
  if (!borrow) throw new Error('No suitable borrow asset found. Seed assets first (e.g., seeds/seed_lending_assets.ts or seeds/seed.ts).')

  let collateral = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
  if (!collateral) {
    collateral = await Asset.findOne({ symbol: 'BTC', network: 'BTC', tokenAddress: { $exists: false } })
  }
  if (!collateral) throw new Error('No suitable collateral asset found. Seed assets first.')

  return { borrow, borrowNetwork, collateral }
}

async function main() {
  try {
    await connectDB()
    const user = await getOrCreateTestUser()
    const { borrow, borrowNetwork, collateral } = await pickAssets()

    const borrowAmount = 50 // tokens
    const borrowUsd = Number(borrow.currentPrice || 0)
    const collateralUsd = Number(collateral.currentPrice || 0)

    const targetLtvLoanToCollateral = 0.5
    const requiredCollateralAmountToken = collateralUsd > 0 ? (borrowAmount * borrowUsd) / targetLtvLoanToCollateral / collateralUsd : 0

    const originationFeePercent = Number(process.env.ORIGINATION_FEE ?? 20)
    const originationFeeAmountToken = borrowAmount * (originationFeePercent / 100)

    // Simple monthly interest percent from asset fees (fallback 5%)
    const monthlyRate = Number((borrow as any)?.fees?.loanInterest?.REG?.d30 ?? 5)

    const now = new Date()

    const loan = await Loan.create({
      userId: user._id,
      loanAssetId: borrow._id,
      loanAmount: borrowAmount,
      borrowNetwork,
      interestRate: monthlyRate,
      collateralAssetId: collateral._id,
      expectedCollateralAmountToken: requiredCollateralAmountToken,
      collateralReceivedAmountToken: requiredCollateralAmountToken,
      targetLtvLoanToCollateral,
      marginCallLtv: Number(process.env.MARGIN_CALL_LTV ?? 0.7),
      liquidationLtv: Number(process.env.LIQUIDATION_LTV ?? 0.8),
      unitPricesAtOrigination: { borrowUsd, collateralUsd },
      valuesAtOrigination: { borrowUsd: borrowAmount * borrowUsd, collateralUsd: requiredCollateralAmountToken * collateralUsd },
      originationFeePercent,
      originationFeeAmountToken,
      payoutMethod: 'INTERNAL',
      status: 'ACTIVE',
      disbursedAt: now,
    } as any)

    // Credit user balance for INTERNAL payout and record transaction
    await UserBalance.findOneAndUpdate(
      { userId: user._id, assetId: borrow._id },
      { $inc: { balance: borrowAmount } },
      { upsert: true, new: true }
    )

    await Transaction.create({
      user: user._id as any,
      type: 'loan-disbursement',
      amount: borrowAmount,
      asset: borrow.symbol,
      status: 'completed',
      loanId: loan._id,
    })

    console.log('\nSeeded ACTIVE loan:')
    console.log(' loanId:', String(loan._id))
    console.log(' userId:', String(user._id))
    console.log(' borrow:', borrow.symbol, 'on', borrowNetwork, 'amount', borrowAmount)
    console.log(' collateral received:', requiredCollateralAmountToken, collateral.symbol)
    console.log(' status: ACTIVE')
  } catch (e) {
    console.error('Seeding active loan failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
