import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt'

import connectDB from '../src/config/db'
import Asset, { type IAsset } from '../src/models/Asset'
import Admin, { AdminRole } from '../src/models/Admin'
import User, { AccountType } from '../src/models/User'
import Wallet from '../src/models/Wallet'
import SavingsAccount from '../src/models/SavingsAccount'

import { createEvmWalletWithViem } from '../src/helpers/wallet/evm'
import { generateTronWallet, generateBtcWallet, generateLTCWallet } from '../src/helpers/wallet/non-evm'

// Small helper to add days to a date
function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function ensureEncryptionKey() {
  // Ensure a valid 32-byte hex MASTER_ENCRYPTION_KEY is present before importing encryptMnemonic
  if (!process.env.MASTER_ENCRYPTION_KEY || Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex').length !== 32) {
    // Generate an ephemeral key for this run. Note: You must persist/set this key to be able to decrypt later.
    process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
    console.warn('MASTER_ENCRYPTION_KEY was not set or invalid. Generated an ephemeral key for this seeding session. Persist this value to decrypt mnemonics later.')
  }
  const security = await import('../src/helpers/wallet/security')
  return security.encryptMnemonic as (text: string) => string
}

async function upsertAssets() {
  // Sample assets with fees aligned to the current Asset schema
  const assets: Partial<IAsset & { kind: any; decimals?: number; tokenAddress?: string }>[] = [
    {
      name: 'Ethereum',
      symbol: 'ETH',
      iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      currentPrice: 3500,
      marketCap: 420_000_000_000,
      circulatingSupply: 120_000_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'ETH',
      kind: 'native',
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 4, d30: 6, d180: 8, d365: 10 },
          PRO: { d7: 3, d30: 5, d180: 7, d365: 9 },
        },
        savingsInterest: {
          REG: { d7: 2, d30: 4, d180: 5, d365: 6 },
          PRO: { d7: 2, d30: 4, d180: 5, d365: 6 },
        },
        sendFeePercent: { REG: 0.1, PRO: 0.08 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 },
        exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 },
        referralFeePercent: { REG: 1, PRO: 1 },
      },
    },
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      iconUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
      currentPrice: 65000,
      marketCap: 1_300_000_000_000,
      circulatingSupply: 19_800_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'BTC',
      kind: 'native',
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 5, d30: 7, d180: 9, d365: 11 },
          PRO: { d7: 4, d30: 6, d180: 8, d365: 10 },
        },
        savingsInterest: {
          REG: { d7: 1.5, d30: 3, d180: 4, d365: 5 },
          PRO: { d7: 1.5, d30: 3, d180: 4, d365: 5 },
        },
        sendFeePercent: { REG: 0.1, PRO: 0.08 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.25, PRO: 0.2 },
        exchangeFeePercentTo: { REG: 0.25, PRO: 0.2 },
        referralFeePercent: { REG: 1, PRO: 1 },
      },
    },
    {
      name: 'Litecoin',
      symbol: 'LTC',
      iconUrl: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
      currentPrice: 75,
      marketCap: 5_500_000_000,
      circulatingSupply: 73_000_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'LTC',
      kind: 'native',
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 6, d30: 8, d180: 10, d365: 12 },
          PRO: { d7: 5, d30: 7, d180: 9, d365: 11 },
        },
        savingsInterest: {
          REG: { d7: 1.25, d30: 2.5, d180: 3.5, d365: 4.5 },
          PRO: { d7: 1.25, d30: 2.5, d180: 3.5, d365: 4.5 },
        },
        sendFeePercent: { REG: 0.1, PRO: 0.08 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 },
        exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 },
        referralFeePercent: { REG: 1, PRO: 1 },
      },
    },
    {
      name: 'Tron',
      symbol: 'TRX',
      iconUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png',
      currentPrice: 0.125,
      marketCap: 10_800_000_000,
      circulatingSupply: 87_000_000_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'TRON',
      kind: 'native',
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 4.5, d30: 6.5, d180: 8.5, d365: 10.5 },
          PRO: { d7: 3.5, d30: 5.5, d180: 7.5, d365: 9.5 },
        },
        savingsInterest: {
          REG: { d7: 2, d30: 3.5, d180: 4.5, d365: 5.5 },
          PRO: { d7: 2, d30: 3.5, d180: 4.5, d365: 5.5 },
        },
        sendFeePercent: { REG: 0.1, PRO: 0.08 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 },
        exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 },
        referralFeePercent: { REG: 1, PRO: 1 },
      },
    },
    // ERC-20 USDT on ETH
    {
      name: 'Tether USD',
      symbol: 'USDT',
      iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      currentPrice: 1,
      marketCap: 110_000_000_000,
      circulatingSupply: 110_000_000_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'ETH',
      kind: 'erc20',
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 3, d30: 4, d180: 5, d365: 6 },
          PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 },
        },
        savingsInterest: {
          REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 },
          PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 },
        },
        sendFeePercent: { REG: 0.05, PRO: 0.04 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 },
        exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 },
        referralFeePercent: { REG: 0.5, PRO: 0.5 },
      },
    },
    // TRC-20 USDT on TRON
    {
      name: 'Tether USD',
      symbol: 'USDT',
      iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      currentPrice: 1,
      marketCap: 110_000_000_000,
      circulatingSupply: 110_000_000_000,
      amountHeld: 0,
      isLendable: true,
      isCollateral: true,
      network: 'TRON',
      kind: 'trc20',
      tokenAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
      decimals: 6,
      status: 'LISTED',
      fees: {
        loanInterest: {
          REG: { d7: 3, d30: 4, d180: 5, d365: 6 },
          PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 },
        },
        savingsInterest: {
          REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 },
          PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 },
        },
        sendFeePercent: { REG: 0.05, PRO: 0.04 },
        receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 },
        exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 },
        referralFeePercent: { REG: 0.5, PRO: 0.5 },
      },
    },
  ]

  const created: Record<string, any> = {}

  for (const a of assets) {
    try {
      let existing: any
      if (a.kind === 'native') {
        existing = await Asset.findOne({ symbol: a.symbol, network: a.network, tokenAddress: { $exists: false } })
      } else {
        existing = await Asset.findOne({ tokenAddress: a.tokenAddress, network: a.network })
      }

      if (existing) {
        // Update core fields in case of re-run
        await Asset.updateOne({ _id: existing._id }, {
          $set: {
            name: a.name,
            symbol: a.symbol,
            iconUrl: a.iconUrl,
            currentPrice: a.currentPrice,
            marketCap: a.marketCap,
            circulatingSupply: a.circulatingSupply,
            isLendable: a.isLendable,
            isCollateral: a.isCollateral,
            status: a.status,
            fees: a.fees,
            decimals: a.decimals,
          }
        })
        created[`${a.symbol}-${a.network}`] = existing
        console.log(`Updated asset ${a.symbol} on ${a.network}`)
      } else {
        const doc = await Asset.create(a as any)
        created[`${a.symbol}-${a.network}`] = doc
        console.log(`Created asset ${a.symbol} on ${a.network}`)
      }
    } catch (e) {
      console.error('Failed to upsert asset', a.symbol, a.network, e)
      throw e
    }
  }

  return created
}

async function createAdmin() {
  const email = 'admin@lendbloc.local'
  const existing = await Admin.findOne({ email })
  if (existing) {
    console.log('Super admin already exists. Skipping admin creation.')
    return existing
  }
  const passwordHash = await bcrypt.hash('Admin@12345', 10)
  const admin = await Admin.create({
    fullName: 'Super Admin',
    username: 'superadmin',
    email,
    secondaryEmail: 'admin2@lendbloc.local',
    phoneNumber: '+15550000001',
    passwordHash,
    role: AdminRole.SUPER_ADMIN,
    isEmailVerified: true,
    isPhoneNumberVerified: true,
  })
  console.log('Created Super Admin:', admin.email)
  return admin
}

async function createUsers() {
  const users = [
    {
      title: 'Mr',
      fullName: 'John Doe',
      dateOfBirth: '01/01/1990',
      email: 'john@example.com',
      phoneNumber: '+1555010001',
      password: 'User@12345',
      kycReferenceId: 'KYC-USER-001',
      referralId: 'REF-USER-001',
      accountType: AccountType.REG,
    },
    {
      title: 'Ms',
      fullName: 'Jane Pro',
      dateOfBirth: '02/02/1992',
      email: 'jane@example.com',
      phoneNumber: '+1555010002',
      password: 'User@12345',
      kycReferenceId: 'KYC-USER-002',
      referralId: 'REF-USER-002',
      accountType: AccountType.PRO,
    },
  ]

  const results: any[] = []
  for (const u of users) {
    let user = await User.findOne({ email: u.email })
    if (!user) {
      const passwordHash = await bcrypt.hash(u.password, 10)
      user = await User.create({
        title: u.title,
        fullName: u.fullName,
        dateOfBirth: u.dateOfBirth,
        email: u.email,
        phoneNumber: u.phoneNumber,
        passwordHash,
        kycReferenceId: u.kycReferenceId,
        referralId: u.referralId,
        isKycVerified: true,
        isEmailVerified: true,
        isPhoneNumberVerified: true,
        allowPasswordReset: true,
        allowEmailChange: true,
        accountType: u.accountType,
      })
      console.log('Created user:', u.email)
    } else {
      console.log('User already exists:', u.email)
    }
    results.push(user)
  }
  return results
}

async function createUserWallets(userId: string, assetsByKey: Record<string, any>, encryptMnemonic: (t: string) => string) {
  // Create one wallet per native network for the user
  // ETH (EVM)
  const evm = createEvmWalletWithViem()
  const evmEncrypted = encryptMnemonic(evm.mnemonic)
  const ethAsset = assetsByKey['ETH-ETH']
  if (ethAsset) {
    await Wallet.create({ userId, assetId: ethAsset._id, address: evm.address, balance: 10, encryptedMnemonic: evmEncrypted, network: 'ETH', isLiquidityWallet: false })
    console.log(`Created ETH wallet for user ${userId}: ${evm.address}`)
  }

  // TRON
  const tron = await generateTronWallet()
  const tronEncrypted = encryptMnemonic(tron.mnemonic)
  const trxAsset = assetsByKey['TRX-TRON']
  if (trxAsset) {
    await Wallet.create({ userId, assetId: trxAsset._id, address: tron.address, balance: 100, encryptedMnemonic: tronEncrypted, network: 'TRON', isLiquidityWallet: false })
    console.log(`Created TRX wallet for user ${userId}: ${tron.address}`)
  }

  // BTC
  const btc = await generateBtcWallet()
  const btcEncrypted = encryptMnemonic(btc.mnemonic)
  const btcAsset = assetsByKey['BTC-BTC']
  if (btcAsset) {
    await Wallet.create({ userId, assetId: btcAsset._id, address: btc.address, balance: 0.1, encryptedMnemonic: btcEncrypted, network: 'BTC', isLiquidityWallet: false })
    console.log(`Created BTC wallet for user ${userId}: ${btc.address}`)
  }

  // LTC
  const ltc = await generateLTCWallet()
  const ltcEncrypted = encryptMnemonic(ltc.mnemonic)
  const ltcAsset = assetsByKey['LTC-LTC']
  if (ltcAsset) {
    await Wallet.create({ userId, assetId: ltcAsset._id, address: ltc.address, balance: 25, encryptedMnemonic: ltcEncrypted, network: 'LTC', isLiquidityWallet: false })
    console.log(`Created LTC wallet for user ${userId}: ${ltc.address}`)
  }
}

async function createAdminLiquidityWallets(adminId: string, assetsByKey: Record<string, any>, encryptMnemonic: (t: string) => string) {
  // ETH
  const evm = createEvmWalletWithViem()
  const evmEnc = encryptMnemonic(evm.mnemonic)
  const ethAsset = assetsByKey['ETH-ETH']
  if (ethAsset) {
    await Wallet.create({ userId: adminId, assetId: ethAsset._id, address: evm.address, balance: 0, encryptedMnemonic: evmEnc, network: 'ETH', isLiquidityWallet: true })
    console.log(`Created ETH liquidity wallet: ${evm.address}`)
  }

  // TRON
  const tron = await generateTronWallet()
  const tronEnc = encryptMnemonic(tron.mnemonic)
  const trxAsset = assetsByKey['TRX-TRON']
  if (trxAsset) {
    await Wallet.create({ userId: adminId, assetId: trxAsset._id, address: tron.address, balance: 0, encryptedMnemonic: tronEnc, network: 'TRON', isLiquidityWallet: true })
    console.log(`Created TRX liquidity wallet: ${tron.address}`)
  }

  // BTC
  const btc = await generateBtcWallet()
  const btcEnc = encryptMnemonic(btc.mnemonic)
  const btcAsset = assetsByKey['BTC-BTC']
  if (btcAsset) {
    await Wallet.create({ userId: adminId, assetId: btcAsset._id, address: btc.address, balance: 0, encryptedMnemonic: btcEnc, network: 'BTC', isLiquidityWallet: true })
    console.log(`Created BTC liquidity wallet: ${btc.address}`)
  }

  // LTC
  const ltc = await generateLTCWallet()
  const ltcEnc = encryptMnemonic(ltc.mnemonic)
  const ltcAsset = assetsByKey['LTC-LTC']
  if (ltcAsset) {
    await Wallet.create({ userId: adminId, assetId: ltcAsset._id, address: ltc.address, balance: 0, encryptedMnemonic: ltcEnc, network: 'LTC', isLiquidityWallet: true })
    console.log(`Created LTC liquidity wallet: ${ltc.address}`)
  }
}

async function seedSavingsForUser(userId: string, assetsByKey: Record<string, any>) {
  const ethAsset = assetsByKey['ETH-ETH']
  if (!ethAsset) return

  const termDays = 30 as 30
  const apy = ethAsset.fees?.savingsInterest?.d30 ?? 0
  const now = new Date()
  const lockStartAt = now
  const lockEndAt = addDays(now, termDays)

  const existing = await SavingsAccount.findOne({ userId, assetId: ethAsset._id, termDays })
  if (existing) {
    console.log('Savings account already exists for user on ETH 30d. Skipping.')
    return existing
  }

  const savings = await SavingsAccount.create({
    userId,
    assetId: ethAsset._id,
    balance: 1.5,
    apy,
    termDays,
    lockStartAt,
    lockEndAt,
  })
  console.log(`Created ETH 30d savings for user ${userId} with APY ${apy}%`)

  // Optionally adjust wallet balance to reflect funds moved into savings (demo only)
  const wallet = await Wallet.findOne({ userId, assetId: ethAsset._id })
  if (wallet) {
    wallet.balance = Math.max(0, (wallet.balance || 0) - 1.5)
    await wallet.save()
  }

  return savings
}

async function main() {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not set. Please configure your database connection string in the environment.')
      process.exit(1)
    }

    // Favor development mode for non-EVM wallet gen/testnets if not explicitly set
    if (!process.env.CURRENT_ENVIRONMENT) {
      process.env.CURRENT_ENVIRONMENT = 'DEVELOPMENT'
    }

    await connectDB()

    const assetsByKey = await upsertAssets()
    const admin = await createAdmin()

    const encryptMnemonic = await ensureEncryptionKey()

    const users = await createUsers()

    for (const u of users) {
      await createUserWallets(String(u._id), assetsByKey, encryptMnemonic)
    }

    await createAdminLiquidityWallets(String(admin._id), assetsByKey, encryptMnemonic)

    // Seed a savings account for the first user
    if (users[0]) {
      await seedSavingsForUser(String(users[0]._id), assetsByKey)
    }

    console.log('Seeding complete.')
  } catch (e) {
    console.error('Seeding failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()

