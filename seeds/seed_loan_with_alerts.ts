import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Loan from '../src/models/Loan'
import Asset from '../src/models/Asset'

async function main() {
  try {
    await connectDB()

    const userId = new mongoose.Types.ObjectId('68c4953703791686cb6ed854')

    // Pick borrow USDT on ETH; fallback to ETH
    let borrow = await Asset.findOne({ symbol: 'USDT', network: 'ETH' })
    let borrowNetwork: 'ETH' | 'TRON' = 'ETH'
    if (!borrow) {
      borrow = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
      borrowNetwork = 'ETH'
    }
    if (!borrow) throw new Error('Borrow asset not found. Seed assets first.')

    // Collateral: ETH fallback to BTC
    let collateral = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
    if (!collateral) {
      collateral = await Asset.findOne({ symbol: 'BTC', network: 'BTC', tokenAddress: { $exists: false } })
    }
    if (!collateral) throw new Error('Collateral asset not found. Seed assets first.')

    const borrowAmount = 80
    const borrowUsd = Number(borrow.currentPrice || 0)
    const collateralUsd = Number(collateral.currentPrice || 0)
    const targetLtvLoanToCollateral = 0.5
    const requiredCollateralAmountToken = collateralUsd > 0 ? (borrowAmount * borrowUsd) / targetLtvLoanToCollateral / collateralUsd : 0

    const originationFeePercent = Number(process.env.ORIGINATION_FEE ?? 20)
    const originationFeeAmountToken = borrowAmount * (originationFeePercent / 100)
    const monthlyRate = Number((borrow as any)?.fees?.loanInterest?.REG?.d30 ?? 5)

    const loan = await Loan.create({
      userId,
      loanAssetId: borrow._id,
      loanAmount: borrowAmount,
      borrowNetwork,
      interestRate: monthlyRate,
      nextInterestAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
      disbursedAt: new Date(),
      alerts: {
        interest: { thresholds: [25, 50, 75] },
        collateral: { dipping: true, thresholds: [-25, -50] }
      }
    } as any)

    console.log('\nSeeded ACTIVE loan with alerts:')
    console.log(' loanId:', String(loan._id))
    console.log(' userId:', String(userId))
    console.log(' borrow:', borrow.symbol, 'on', borrowNetwork, 'amount', borrowAmount)
    console.log(' alerts:', JSON.stringify(loan.alerts))
  } catch (e) {
    console.error('Seed loan with alerts failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
