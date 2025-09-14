import 'dotenv/config'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import { ensureIndexes } from '../src/config/indexes'
import Asset from '../src/models/Asset'
import User, { AccountType } from '../src/models/User'
import Wallet from '../src/models/Wallet'
import UserBalance from '../src/models/UserBalance'
import SavingsAccount from '../src/models/SavingsAccount'
import Loan from '../src/models/Loan'
import Transaction from '../src/models/Transaction'
import SeedLock from '../src/models/SeedLock'
import { createEvmWalletWithViem } from '../src/helpers/wallet/evm'
import { generateTronWallet, generateBtcWallet, generateLTCWallet } from '../src/helpers/wallet/non-evm'
import { encryptMnemonic } from '../src/helpers/wallet/security'

const PROFILE = process.env.SEED_PROFILE || 'DEMO_3_USERS'
const LOCK_KEY = process.env.SEED_LOCK_KEY || 'prod-demo-v1'

function reqEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

async function upsertAsset(doc: any) {
  if (doc.kind === 'native' || !doc.tokenAddress) {
    const existing = await Asset.findOne({ symbol: doc.symbol, network: doc.network, tokenAddress: { $exists: false } })
    if (existing) {
      await Asset.updateOne({ _id: existing._id }, { $set: doc })
      return existing
    }
    return await Asset.create(doc)
  }
  const existing = await Asset.findOne({ tokenAddress: doc.tokenAddress, network: doc.network })
  if (existing) {
    await Asset.updateOne({ _id: existing._id }, { $set: doc })
    return existing
  }
  return await Asset.create(doc)
}

async function ensureBaselineAssets() {
  const assets = [
    // natives
    { name: 'Ethereum', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', currentPrice: 2500, marketCap: 420_000_000_000, circulatingSupply: 120_000_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'ETH', kind: 'native', status: 'LISTED', fees: { loanInterest: { REG: { d7: 3, d30: 4, d180: 6, d365: 8 }, PRO: { d7: 2, d30: 3, d180: 5, d365: 7 } }, savingsInterest: { REG: { d7: 1, d30: 2, d180: 3, d365: 4 }, PRO: { d7: 1, d30: 2, d180: 3, d365: 4 } }, sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 } } },
    { name: 'Bitcoin', symbol: 'BTC', iconUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', currentPrice: 50000, marketCap: 1_300_000_000_000, circulatingSupply: 19_800_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'BTC', kind: 'native', status: 'LISTED', fees: { loanInterest: { REG: { d7: 4, d30: 6, d180: 8, d365: 10 }, PRO: { d7: 3, d30: 5, d180: 7, d365: 9 } }, savingsInterest: { REG: { d7: 1, d30: 2, d180: 3, d365: 4 }, PRO: { d7: 1, d30: 2, d180: 3, d365: 4 } }, sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.25, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.25, PRO: 0.2 }, referralFeePercent: { REG: 1, PRO: 1 } } },
    { name: 'Litecoin', symbol: 'LTC', iconUrl: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png', currentPrice: 70, marketCap: 5_500_000_000, circulatingSupply: 73_000_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'LTC', kind: 'native', status: 'LISTED', fees: { loanInterest: { REG: { d7: 5, d30: 7, d180: 9, d365: 11 }, PRO: { d7: 4, d30: 6, d180: 8, d365: 10 } }, savingsInterest: { REG: { d7: 1, d30: 2, d180: 3, d365: 4 }, PRO: { d7: 1, d30: 2, d180: 3, d365: 4 } }, sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 } } },
    { name: 'Tron', symbol: 'TRX', iconUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png', currentPrice: 0.1, marketCap: 10_000_000_000, circulatingSupply: 87_000_000_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'TRON', kind: 'native', status: 'LISTED', fees: { loanInterest: { REG: { d7: 3, d30: 4, d180: 6, d365: 8 }, PRO: { d7: 2, d30: 3, d180: 5, d365: 7 } }, savingsInterest: { REG: { d7: 1, d30: 2, d180: 3, d365: 4 }, PRO: { d7: 1, d30: 2, d180: 3, d365: 4 } }, sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 } } },
    // tokens
    { name: 'Tether USD', symbol: 'USDT', iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png', currentPrice: 1, marketCap: 110_000_000_000, circulatingSupply: 110_000_000_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'ETH', kind: 'erc20', tokenAddress: '0xUSDT_FAKE', decimals: 6, status: 'LISTED', fees: { loanInterest: { REG: { d7: 3, d30: 4, d180: 5, d365: 6 }, PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 } }, savingsInterest: { REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 }, PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 } }, sendFeePercent: { REG: 0.05, PRO: 0.04 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 }, exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 }, referralFeePercent: { REG: 0.5, PRO: 0.5 } } },
    { name: 'Tether USD', symbol: 'USDT', iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png', currentPrice: 1, marketCap: 110_000_000_000, circulatingSupply: 110_000_000_000, amountHeld: 0, isLendable: true, isCollateral: true, network: 'TRON', kind: 'trc20', tokenAddress: 'TRON_USDT_FAKE', decimals: 6, status: 'LISTED', fees: { loanInterest: { REG: { d7: 3, d30: 4, d180: 5, d365: 6 }, PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 } }, savingsInterest: { REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 }, PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 } }, sendFeePercent: { REG: 0.05, PRO: 0.04 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 }, exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 }, exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 }, referralFeePercent: { REG: 0.5, PRO: 0.5 } } },
  ]
  for (const a of assets) await upsertAsset(a)
}

async function ensureLiquidityWallets(adminId: mongoose.Types.ObjectId) {
  // ETH liquidity
  const ethAsset = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
  if (ethAsset) {
    let w = await Wallet.findOne({ isLiquidityWallet: true, network: 'ETH' })
    if (!w) {
      const evm = createEvmWalletWithViem()
      const enc = encryptMnemonic(evm.mnemonic)
      w = await Wallet.create({ userId: adminId, assetId: ethAsset._id, address: evm.address, encryptedMnemonic: enc, balance: 0, network: 'ETH', isLiquidityWallet: true })
    }
  }
  // TRON liquidity
  const trxAsset = await Asset.findOne({ symbol: 'TRX', network: 'TRON', tokenAddress: { $exists: false } })
  if (trxAsset) {
    let w = await Wallet.findOne({ isLiquidityWallet: true, network: 'TRON' })
    if (!w) {
      const tron = await generateTronWallet()
      const enc = encryptMnemonic(tron.mnemonic)
      w = await Wallet.create({ userId: adminId, assetId: trxAsset._id, address: tron.address, encryptedMnemonic: enc, balance: 0, network: 'TRON', isLiquidityWallet: true })
    }
  }
}

async function ensureAdmin(): Promise<mongoose.Types.ObjectId> {
  const email = process.env.ADMIN_EMAIL || 'admin@lendbloc.local'
  const existing = await (await import('../src/models/Admin')).default.findOne({ email })
  if (existing) return existing._id as any
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10)
  const admin = await (await import('../src/models/Admin')).default.create({
    role: (await import('../src/models/Admin')).AdminRole.SUPER_ADMIN,
    fullName: 'Super Admin',
    username: 'superadmin',
    email,
    secondaryEmail: 'admin2@lendbloc.local',
    phoneNumber: '+15550000000',
    passwordHash,
    isEmailVerified: true,
    isPhoneNumberVerified: true,
  })
  return admin._id as any
}

function stableIds(s: string) {
  // simple deterministic strings
  const slug = s.toLowerCase().replace(/[^a-z0-9]/g, '-')
  return {
    email: `${slug}@lendbloc.local`,
    phone: `+1555000${1000 + Math.abs(hashCode(slug)) % 8999}`,
  }
}

function hashCode(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i)
  return h
}

async function createDemoUser(label: string, opts: { balances?: Record<string, number> }) {
  const idents = stableIds(`demo-${label}`)
  let user = await User.findOne({ email: idents.email })
  if (!user) {
    const passwordHash = await bcrypt.hash('Demo@12345', 10)
    user = await User.create({
      fullName: `Demo ${label.toUpperCase()}`,
      email: idents.email,
      phoneNumber: idents.phone,
      passwordHash,
      kycReferenceId: `KYC-${label.toUpperCase()}`,
      referralId: `REF-${label.toUpperCase()}`,
      isKycVerified: true,
      isEmailVerified: true,
      isPhoneNumberVerified: true,
      allowPasswordReset: true,
      allowEmailChange: true,
      accountType: AccountType.REG,
    })
  }

  // Wallets
  const evm = createEvmWalletWithViem()
  const encEvm = encryptMnemonic(evm.mnemonic)
  const ethAsset = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
  if (ethAsset) {
    await Wallet.findOneAndUpdate(
      { userId: user._id, network: 'ETH', isLiquidityWallet: false, assetId: ethAsset._id },
      { $setOnInsert: { address: evm.address, encryptedMnemonic: encEvm, balance: 0, network: 'ETH' } },
      { upsert: true }
    )
  }
  const tron = await generateTronWallet()
  const encTron = encryptMnemonic(tron.mnemonic)
  const trxAsset = await Asset.findOne({ symbol: 'TRX', network: 'TRON', tokenAddress: { $exists: false } })
  if (trxAsset) {
    await Wallet.findOneAndUpdate(
      { userId: user._id, network: 'TRON', isLiquidityWallet: false, assetId: trxAsset._id },
      { $setOnInsert: { address: tron.address, encryptedMnemonic: encTron, balance: 0, network: 'TRON' } },
      { upsert: true }
    )
  }

  // Balances
  if (opts.balances) {
    for (const [symbol, amount] of Object.entries(opts.balances)) {
      const asset = await Asset.findOne({ symbol, status: 'LISTED' })
      if (asset) {
        // Set exact target balance idempotently to avoid ConflictingUpdateOperators between $setOnInsert and $inc
        await UserBalance.findOneAndUpdate(
          { userId: user._id, assetId: asset._id },
          { $set: { balance: amount } },
          { upsert: true }
        )
      }
    }
  }

  return user
}

async function seedDemoProfile() {
  if (PROFILE !== 'DEMO_3_USERS') {
    console.log(`Unknown SEED_PROFILE=${PROFILE}; nothing to do.`)
    return
  }

  // Ensure assets
  await ensureBaselineAssets()

  // Ensure admin + liquidity wallets
  const adminId = await ensureAdmin()
  await ensureLiquidityWallets(adminId)

  // Demo A: balances + savings
  const demoA = await createDemoUser('a', { balances: { ETH: 1.2, USDT: 500, TRX: 1000 } })
  const ethAsset = await Asset.findOne({ symbol: 'ETH', network: 'ETH', tokenAddress: { $exists: false } })
  if (ethAsset) {
    const now = new Date()
    const lockEndAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    await SavingsAccount.findOneAndUpdate(
      { userId: demoA._id, assetId: ethAsset._id, status: 'ACTIVE' },
      { $setOnInsert: { balance: 0.2, apy: 4, termDays: 30, lockStartAt: now, lockEndAt, lastPayoutAt: now, status: 'ACTIVE' } },
      { upsert: true }
    )
  }

  // Demo B: active loan + alerts
  const demoB = await createDemoUser('b', { balances: { ETH: 0.5, USDT: 200 } })
  const usdtEth = await Asset.findOne({ symbol: 'USDT', network: 'ETH' })
  if (ethAsset && usdtEth) {
    const borrowAmount = 100
    const borrowUsd = Number(usdtEth.currentPrice || 1)
    const collateralUsd = Number(ethAsset.currentPrice || 2500)
    const targetLtvLoanToCollateral = 0.5
    const requiredCollateral = (borrowAmount * borrowUsd) / targetLtvLoanToCollateral / collateralUsd
    const loan = await Loan.findOne({ userId: demoB._id, loanAssetId: usdtEth._id, status: 'ACTIVE' }) || await Loan.create({
      userId: demoB._id,
      loanAssetId: usdtEth._id,
      loanAmount: borrowAmount,
      borrowNetwork: 'ETH',
      interestRate: 5,
      collateralAssetId: ethAsset._id,
      expectedCollateralAmountToken: requiredCollateral,
      collateralReceivedAmountToken: requiredCollateral,
      targetLtvLoanToCollateral,
      marginCallLtv: 0.7,
      liquidationLtv: 0.8,
      unitPricesAtOrigination: { borrowUsd, collateralUsd },
      valuesAtOrigination: { borrowUsd: borrowAmount * borrowUsd, collateralUsd: requiredCollateral * collateralUsd },
      originationFeePercent: 20,
      originationFeeAmountToken: borrowAmount * 0.2,
      payoutMethod: 'INTERNAL',
      status: 'ACTIVE',
      disbursedAt: new Date(),
      alerts: { interest: { thresholds: [25, 50, 75, 90] }, collateral: { dipping: true, thresholds: [-25, -50] } }
    } as any)
    await Transaction.create({ user: demoB._id as any, type: 'interest-accrual', amount: borrowAmount * 0.05, asset: usdtEth.symbol, status: 'completed', loanId: loan._id })
  }

  // Demo C: pending collateral + swap
  const demoC = await createDemoUser('c', { balances: { ETH: 0.3, USDT: 50 } })
  if (ethAsset && usdtEth) {
    const borrowAmount = 150
    const borrowUsd = Number(usdtEth.currentPrice || 1)
    const collateralUsd = Number(ethAsset.currentPrice || 2500)
    const requiredCollateral = (borrowAmount * borrowUsd) / 0.5 / collateralUsd
    await Loan.findOneAndUpdate(
      { userId: demoC._id, loanAssetId: usdtEth._id, status: 'PENDING_COLLATERAL' },
      { $setOnInsert: {
        loanAmount: borrowAmount,
        borrowNetwork: 'ETH',
        interestRate: 5,
        collateralAssetId: ethAsset._id,
        expectedCollateralAmountToken: requiredCollateral,
        collateralReceivedAmountToken: 0,
        targetLtvLoanToCollateral: 0.5,
        marginCallLtv: 0.7,
        liquidationLtv: 0.8,
        unitPricesAtOrigination: { borrowUsd, collateralUsd },
        valuesAtOrigination: { borrowUsd: borrowAmount * borrowUsd, collateralUsd: requiredCollateral * collateralUsd },
        originationFeePercent: 20,
        originationFeeAmountToken: borrowAmount * 0.2,
        payoutMethod: 'EXTERNAL',
        status: 'PENDING_COLLATERAL',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      } },
      { upsert: true }
    )
    // Simple swap transaction sample
    await Transaction.create({ user: demoC._id as any, type: 'swap', amount: 10, asset: 'USDT', status: 'completed', swapDetails: { fromSymbol: 'ETH', toSymbol: 'USDT', fromAmountToken: 0.004, toAmountToken: 10, fromAmountUsd: 10, toAmountUsd: 10, rateFromUsd: 2500, rateToUsd: 1 } as any })
  }
}

async function main() {
  try {
    // Required secrets
    reqEnv('MONGO_URI')
    reqEnv('MASTER_ENCRYPTION_KEY')
    reqEnv('JWT_SECRET')

    await connectDB()
    await ensureIndexes()

    const existing = await SeedLock.findOne({ key: LOCK_KEY })
    if (existing) {
      console.log(`[seed] ${LOCK_KEY} already applied at ${existing.appliedAt.toISOString()}`)
      return
    }

    console.log(`[seed] Applying profile=${PROFILE} with lock=${LOCK_KEY}`)
    await seedDemoProfile()

    await SeedLock.create({ key: LOCK_KEY, version: 'v1', appliedAt: new Date() })
    console.log('[seed] Demo dataset applied successfully')
  } catch (e) {
    console.error('[seed] Failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()
