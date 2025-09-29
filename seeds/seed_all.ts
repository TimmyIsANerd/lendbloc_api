import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { faker } from '@faker-js/faker'
import { addDays, subDays } from 'date-fns'

// Import models
import connectDB from '../src/config/db'
import Asset, { type IAsset } from '../src/models/Asset'
import Admin, { AdminRole } from '../src/models/Admin'
import User, { AccountType } from '../src/models/User'
import type { IUser } from '../src/models/User'
import Wallet from '../src/models/Wallet'
import SavingsAccount from '../src/models/SavingsAccount'
import Loan from '../src/models/Loan'
import Transaction from '../src/models/Transaction'
import Notification from '../src/models/Notification'
import Referral from '../src/models/Referral'
import Otp from '../src/models/Otp'

// Import helpers
import { createEvmWalletWithViem } from '../src/helpers/wallet/evm'
import { generateTronWallet, generateBtcWallet, generateLTCWallet } from '../src/helpers/wallet/non-evm'

// Constants
const NUM_TEST_USERS = 20
const NUM_LOANS_PER_USER = 3
const NUM_SAVINGS_ACCOUNTS_PER_USER = 2

// Default credentials for seeded accounts
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345'
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'User@12345'

// Types
type TestUser = {
  title: string
  fullName: string
  dateOfBirth: string
  email: string
  phoneNumber: string
  password: string
  kycReferenceId: string
  referralId: string
  accountType: AccountType
  isAdmin?: boolean
  adminRole?: AdminRole
}

interface TestAsset {
  _id?: any
  name: string
  symbol: string
  iconUrl: string
  currentPrice: number
  marketCap: number
  circulatingSupply: number
  amountHeld: number
  isLendable: boolean
  isCollateral: boolean
  network: string
  kind: 'native' | 'erc20' | 'trc20'
  tokenAddress?: string
  decimals?: number
  status: 'LISTED' | 'PENDING_VOTES' | 'DELISTED'
  fees: any
}

// Helper functions
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomAmount(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(8));
}

async function ensureEncryptionKey() {
  if (!process.env.MASTER_ENCRYPTION_KEY || Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex').length !== 32) {
    process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
    console.warn('MASTER_ENCRYPTION_KEY was not set or invalid. Generated an ephemeral key for this seeding session.')
  }
  const security = await import('../src/helpers/wallet/security')
  return security.encryptMnemonic as (text: string) => string
}

// Data generation functions
function generateTestAssets(): TestAsset[] {
  const assets: TestAsset[] = [
    // Native networks
    {
      name: 'Ethereum', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      currentPrice: 3500, marketCap: 420_000_000_000, circulatingSupply: 120_000_000, amountHeld: 10000,
      isLendable: true, isCollateral: true, network: 'ETH', kind: 'native', status: 'LISTED',
      fees: {
        loanInterest: { REG: { d7: 4, d30: 6, d180: 8, d365: 10 }, PRO: { d7: 3, d30: 5, d180: 7, d365: 9 } },
        savingsInterest: { REG: { d7: 2, d30: 4, d180: 5, d365: 6 }, PRO: { d7: 2, d30: 4, d180: 5, d365: 6 } },
        sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 },
      }
    },
    {
      name: 'Bitcoin', symbol: 'BTC', iconUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
      currentPrice: 65000, marketCap: 1_300_000_000_000, circulatingSupply: 19_800_000, amountHeld: 1000,
      isLendable: true, isCollateral: true, network: 'BTC', kind: 'native', status: 'LISTED',
      fees: {
        loanInterest: { REG: { d7: 5, d30: 7, d180: 9, d365: 11 }, PRO: { d7: 4, d30: 6, d180: 8, d365: 10 } },
        savingsInterest: { REG: { d7: 1.5, d30: 3, d180: 4, d365: 5 }, PRO: { d7: 1.5, d30: 3, d180: 4, d365: 5 } },
        sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.25, PRO: 0.2 }, exchangeFeePercentTo: { REG: 0.25, PRO: 0.2 }, referralFeePercent: { REG: 1, PRO: 1 },
      }
    },
    {
      name: 'Litecoin', symbol: 'LTC', iconUrl: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
      currentPrice: 75, marketCap: 5_500_000_000, circulatingSupply: 73_000_000, amountHeld: 10000,
      isLendable: true, isCollateral: true, network: 'LTC', kind: 'native', status: 'LISTED',
      fees: {
        loanInterest: { REG: { d7: 6, d30: 8, d180: 10, d365: 12 }, PRO: { d7: 5, d30: 7, d180: 9, d365: 11 } },
        savingsInterest: { REG: { d7: 1.25, d30: 2.5, d180: 3.5, d365: 4.5 }, PRO: { d7: 1.25, d30: 2.5, d180: 3.5, d365: 4.5 } },
        sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 },
      }
    },
    {
      name: 'Tron', symbol: 'TRX', iconUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png',
      currentPrice: 0.125, marketCap: 10_800_000_000, circulatingSupply: 87_000_000_000, amountHeld: 1000000,
      isLendable: true, isCollateral: true, network: 'TRON', kind: 'native', status: 'LISTED',
      fees: {
        loanInterest: { REG: { d7: 4.5, d30: 6.5, d180: 8.5, d365: 10.5 }, PRO: { d7: 3.5, d30: 5.5, d180: 7.5, d365: 9.5 } },
        savingsInterest: { REG: { d7: 2, d30: 3.5, d180: 4.5, d365: 5.5 }, PRO: { d7: 2, d30: 3.5, d180: 4.5, d365: 5.5 } },
        sendFeePercent: { REG: 0.1, PRO: 0.08 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.2, PRO: 0.15 }, exchangeFeePercentTo: { REG: 0.2, PRO: 0.15 }, referralFeePercent: { REG: 1, PRO: 1 },
      }
    },
    // Tokens: USDT on ETH & TRON
    {
      name: 'Tether USD', symbol: 'USDT', iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      currentPrice: 1, marketCap: 110_000_000_000, circulatingSupply: 110_000_000_000, amountHeld: 10000000,
      isLendable: true, isCollateral: true, network: 'ETH', kind: 'erc20', status: 'LISTED',
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,
      fees: {
        loanInterest: { REG: { d7: 3, d30: 4, d180: 5, d365: 6 }, PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 } },
        savingsInterest: { REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 }, PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 } },
        sendFeePercent: { REG: 0.05, PRO: 0.04 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 }, exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 }, referralFeePercent: { REG: 0.5, PRO: 0.5 },
      }
    },
    {
      name: 'Tether USD', symbol: 'USDT', iconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      currentPrice: 1, marketCap: 110_000_000_000, circulatingSupply: 110_000_000_000, amountHeld: 10000000,
      isLendable: true, isCollateral: true, network: 'TRON', kind: 'trc20', status: 'LISTED',
      tokenAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', decimals: 6,
      fees: {
        loanInterest: { REG: { d7: 3, d30: 4, d180: 5, d365: 6 }, PRO: { d7: 2.5, d30: 3.5, d180: 4.5, d365: 5.5 } },
        savingsInterest: { REG: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 }, PRO: { d7: 1.5, d30: 2.5, d180: 3.5, d365: 4.5 } },
        sendFeePercent: { REG: 0.05, PRO: 0.04 }, receiveFeePercent: { REG: 0.05, PRO: 0.04 },
        exchangeFeePercentFrom: { REG: 0.1, PRO: 0.08 }, exchangeFeePercentTo: { REG: 0.1, PRO: 0.08 }, referralFeePercent: { REG: 0.5, PRO: 0.5 },
      }
    },
  ]
  return assets
}

function generateTestUsers(): TestUser[] {
  const users: TestUser[] = [
    // Admin (fixed)
    {
      title: 'Admin',
      fullName: 'Admin User',
      dateOfBirth: '01/01/1980',
      email: DEFAULT_ADMIN_EMAIL,
      phoneNumber: '+15550000001',
      password: DEFAULT_ADMIN_PASSWORD,
      kycReferenceId: 'KYC-ADMIN-001',
      referralId: 'ADMIN-001',
      accountType: AccountType.PRO,
      isAdmin: true,
      adminRole: AdminRole.SUPER_ADMIN
    },
    // Fixed test users for FE/mobile convenience
    {
      title: 'Mr',
      fullName: 'John Doe',
      dateOfBirth: '01/01/1990',
      email: 'john.doe@lendbloc.local',
      phoneNumber: '+1555010001',
      password: DEFAULT_USER_PASSWORD,
      kycReferenceId: 'KYC-FIX-001',
      referralId: 'REF-FIX-001',
      accountType: AccountType.REG,
    },
    {
      title: 'Ms',
      fullName: 'Jane Pro',
      dateOfBirth: '02/02/1992',
      email: 'jane.pro@lendbloc.local',
      phoneNumber: '+1555010002',
      password: DEFAULT_USER_PASSWORD,
      kycReferenceId: 'KYC-FIX-002',
      referralId: 'REF-FIX-002',
      accountType: AccountType.PRO,
    },
    // Additional generated users
    ...Array.from({ length: NUM_TEST_USERS }, (_, i) => ({
      title: faker.helpers.arrayElement(['Mr', 'Ms', 'Mrs', 'Dr']),
      fullName: faker.person.fullName(),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toLocaleDateString(),
      email: faker.internet.email().toLowerCase(),
      phoneNumber: `+1555${faker.string.numeric(7)}`,
      password: DEFAULT_USER_PASSWORD,
      kycReferenceId: `KYC-USER-${String(i + 1).padStart(4, '0')}`,
      referralId: `USER-${String(i + 1).padStart(4, '0')}`,
      accountType: faker.helpers.weightedArrayElement([
        { weight: 0.7, value: AccountType.REG },
        { weight: 0.3, value: AccountType.PRO }
      ])
    }))
  ]

  return users
}

// Database operations
async function clearExistingData() {
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
    throw new Error('Refusing to clear data in production without FORCE_SEED')
  }

  console.log('Clearing existing data...')
  await Promise.all([
    Asset.deleteMany({}),
    Admin.deleteMany({}),
    User.deleteMany({}),
    Wallet.deleteMany({}),
    SavingsAccount.deleteMany({}),
    Loan.deleteMany({}),
    Transaction.deleteMany({}),
    Notification.deleteMany({}),
    Referral.deleteMany({}),
    Otp.deleteMany({})
  ])
}

async function seedAssets(): Promise<Record<string, any>> {
  console.log('Seeding assets...')
  const testAssets = generateTestAssets()
  const assetsByKey: Record<string, any> = {}

  for (const a of testAssets) {
    let existing: any | null = null
    if (a.kind === 'native' || !a.tokenAddress) {
      existing = await Asset.findOne({ symbol: a.symbol, network: a.network, tokenAddress: { $exists: false } })
    } else {
      existing = await Asset.findOne({ tokenAddress: a.tokenAddress, network: a.network })
    }

    if (existing) {
      await Asset.updateOne({ _id: existing._id }, {
        $set: {
          name: a.name,
          symbol: a.symbol,
          iconUrl: a.iconUrl,
          currentPrice: a.currentPrice,
          marketCap: a.marketCap,
          circulatingSupply: a.circulatingSupply,
          amountHeld: a.amountHeld,
          isLendable: a.isLendable,
          isCollateral: a.isCollateral,
          status: a.status,
          fees: a.fees,
          decimals: a.decimals,
        }
      })
      assetsByKey[`${a.symbol}-${a.network}`] = existing
      console.log(`Updated asset ${a.symbol} on ${a.network}`)
    } else {
      const doc = await Asset.create(a as any)
      assetsByKey[`${a.symbol}-${a.network}`] = doc
      console.log(`Created asset ${a.symbol} on ${a.network}`)
    }
  }

  return assetsByKey
}

async function seedUsers(assetsByKey: Record<string, any>, encryptMnemonic: (t: string) => string) {
  console.log('Seeding users...')
  const testUsers = generateTestUsers()
  const users: IUser[] = []
  const createdCreds: { email: string; password: string; role: 'ADMIN' | 'USER' }[] = []

  for (const userData of testUsers) {
    const { isAdmin, adminRole, ...userFields } = userData

    // Check if user exists
    let user = await User.findOne({ email: userFields.email })

    if (!user) {
      const passwordHash = await bcrypt.hash(userFields.password, 10)
      user = await User.create({
        ...userFields,
        passwordHash,
        isKycVerified: true,
        isEmailVerified: true,
        isPhoneNumberVerified: true,
        allowPasswordReset: true,
        allowEmailChange: true,
      })

      console.log(`Created user: ${user.email} (${user.accountType})`)

      // Track credentials for output
      createdCreds.push({ email: user.email || '', password: userFields.password, role: isAdmin ? 'ADMIN' : 'USER' })

      // Create admin record if this is an admin user and adminRole is defined
      if (isAdmin && adminRole) {
        const adminData = {
          fullName: user.fullName || 'Admin User',
          username: user.email?.split('@')[0] || `admin_${Date.now()}`,
          email: user.email || `admin${Date.now()}@example.com`,
          secondaryEmail: `secondary.${Date.now()}@example.com`,
          phoneNumber: user.phoneNumber || `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          passwordHash: user.passwordHash || (await bcrypt.hash('password123', 10)),
          role: adminRole,
          isEmailVerified: true,
          isPhoneNumberVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await Admin.create(adminData);
        console.log(`Created admin: ${adminData.email} (${adminRole})`);
      }

      // Create wallets for the user (native networks only)
      await createUserWallets(String(user._id), assetsByKey, encryptMnemonic)

      // Create savings accounts
      await createSavingsAccounts(String(user._id), assetsByKey)

      // Create loans
      await createLoans(String(user._id), assetsByKey)

      // Create transactions for the user
      await createTransactions(String(user._id), assetsByKey)

      // Create notifications
      await createNotifications(String(user._id))
    } else {
      console.log(`User already exists: ${user.email}`)
    }

    users.push(user)
  }

  if (createdCreds.length) {
    console.log('\nSeeded account credentials (development):')
    for (const c of createdCreds) {
      console.log(` - [${c.role}] ${c.email}  |  password: ${c.password}`)
    }
    console.log('Note: Credentials are printed only for accounts created in this run. Existing accounts keep their current passwords.')
  }

  return users
}

async function createUserWallets(userId: string, assetsByKey: Record<string, any>, encryptMnemonic: (t: string) => string) {
  console.log(`Creating wallets for user ${userId}...`)
  const created: any[] = []

  // Only create wallets for native assets to avoid duplicate address conflicts
  const nativeAssets = Object.values(assetsByKey).filter((a: any) => a.kind === 'native')

  for (const asset of nativeAssets as any[]) {
    // Skip if a wallet already exists for this user+asset
    const existing = await Wallet.findOne({ userId, assetId: asset._id, isLiquidityWallet: false })
    if (existing) {
      continue
    }

    try {
      let walletAddress = ''
      let mnemonic = ''

      switch (asset.network) {
        case 'ETH':
        case 'BSC':
        case 'MATIC': {
          const evmWallet = createEvmWalletWithViem() as unknown as { address: string; mnemonic: string }
          walletAddress = evmWallet.address
          mnemonic = (evmWallet as any).mnemonic
          break
        }
        case 'TRON': {
          const tronWallet = await generateTronWallet()
          walletAddress = tronWallet.address
          mnemonic = tronWallet.mnemonic
          break
        }
        case 'BTC': {
          const btcWallet = await generateBtcWallet()
          walletAddress = btcWallet.address
          mnemonic = btcWallet.mnemonic
          break
        }
        case 'LTC': {
          const ltcWallet = await generateLTCWallet()
          walletAddress = ltcWallet.address
          mnemonic = ltcWallet.mnemonic
          break
        }
        default:
          console.warn(`Unsupported network: ${asset.network}, skipping wallet creation`)
          continue
      }

      const encryptedMnemonic = encryptMnemonic(mnemonic)

      const w = await Wallet.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), assetId: asset._id, isLiquidityWallet: false },
        { $setOnInsert: { address: walletAddress, encryptedMnemonic, network: asset.network } },
        { upsert: true, new: true }
      )
      created.push(w)
      console.log(`Created wallet for ${asset.symbol} (${asset.network}) for user ${userId}`)
    } catch (error) {
      console.error(`Error creating ${asset.symbol} wallet for user ${userId}:`, error)
    }
  }

  return created
}

async function createSavingsAccounts(userId: string, assetsByKey: Record<string, any>) {
  console.log(`Creating savings accounts for user ${userId}...`)
  const savingsAccounts: any[] = []

  const lendableAssets = Object.values(assetsByKey).filter((a: any) => a.isLendable)
  const selectedAssets = faker.helpers.arrayElements(lendableAssets as any[], Math.min(NUM_SAVINGS_ACCOUNTS_PER_USER, lendableAssets.length))

  for (const asset of selectedAssets as any[]) {
    // Ensure idempotency: only one ACTIVE per user+asset
    const existing = await SavingsAccount.findOne({ userId, assetId: asset._id, status: 'ACTIVE' })
    if (existing) { continue }

    const termChoices = [7, 30, 180, 365] as const
    const termDays = faker.helpers.arrayElement(termChoices)

    const lockStartAt = new Date()
    const lockEndAt = new Date(lockStartAt.getTime() + termDays * 24 * 60 * 60 * 1000)

    // Use REG tier for seeding
    const termKey = (`d${termDays}` as 'd7' | 'd30' | 'd180' | 'd365')
    const apy = Number(asset?.fees?.savingsInterest?.REG?.[termKey] ?? 0)

    const savingsAccount = await SavingsAccount.create({
      userId: new mongoose.Types.ObjectId(userId),
      assetId: asset._id,
      balance: randomAmount(1, 5),
      apy,
      termDays,
      lockStartAt,
      lockEndAt,
      lastPayoutAt: lockStartAt,
      status: 'ACTIVE',
    })
    savingsAccounts.push(savingsAccount)
    console.log(`Created ${asset.symbol} savings account (term ${termDays}d, apy ${apy}%) for user ${userId}`)
  }

  return savingsAccounts
}

async function createLoans(userId: string, assetsByKey: Record<string, any>) {
  console.log(`Creating loans for user ${userId}...`)
  const loans = []
  
  // Get random assets for loans
  const collateralAssets = Object.values(assetsByKey)
    .filter((asset: any) => asset.isCollateral)
    .sort(() => 0.5 - Math.random())
    .slice(0, NUM_LOANS_PER_USER)
  
  for (const collateralAsset of collateralAssets) {
    // Find a borrowable asset (could be the same or different)
    const borrowableAssets = Object.values(assetsByKey)
      .filter((asset: any) => asset.isLendable)
      .sort(() => 0.5 - Math.random())
      
    if (borrowableAssets.length === 0) continue
    
    const borrowAsset = borrowableAssets[0]
    const collateralAmount = randomAmount(0.1, 5)
    const loanAmount = randomAmount(10, 1000) / (borrowAsset.currentPrice || 1)
const durationDays = faker.helpers.arrayElement([7, 30, 180, 365])
    const startDate = subDays(new Date(), Math.floor(Math.random() * durationDays))
    const endDate = addDays(startDate, durationDays)
    const isActive = Math.random() > 0.3 // 70% chance of being active
    
    const loanData = {
      userId: new mongoose.Types.ObjectId(userId),
      loanAssetId: borrowAsset._id,
      loanAmount: loanAmount,
      borrowNetwork: borrowAsset.network === 'TRON' ? 'TRON' : 'ETH',
      interestRate: collateralAsset.fees?.loanInterest?.REG?.[`d${durationDays}`] || 10, // Default to 10%
      nextInterestAt: addDays(new Date(), 30),
      
      collateralAssetId: collateralAsset._id,
      expectedCollateralAmountToken: collateralAmount,
      collateralReceivedAmountToken: collateralAmount * 0.9, // Assume 90% received
      collateralWalletId: null,
      collateralReceivingAddress: `0x${crypto.randomBytes(20).toString('hex')}`,
      
      targetLtvLoanToCollateral: 0.5,
      marginCallLtv: 0.6,
      liquidationLtv: 0.8,
      
      unitPricesAtOrigination: {
        borrowUsd: borrowAsset.currentPrice || 1,
        collateralUsd: collateralAsset.currentPrice || 1
      },
      valuesAtOrigination: {
        borrowUsd: (borrowAsset.currentPrice || 1) * loanAmount,
        collateralUsd: (collateralAsset.currentPrice || 1) * collateralAmount
      },
      
      originationFeePercent: 1.5,
      originationFeeAmountToken: loanAmount * 0.015,
      
      payoutMethod: 'INTERNAL',
      payoutAddress: `0x${crypto.randomBytes(20).toString('hex')}`,
      
      alerts: {
        interest: { thresholds: [25, 50, 75, 90] },
        collateral: { dipping: true, thresholds: [25, 50, 75, 90] }
      },
      
      status: isActive ? 'ACTIVE' : 'REPAID',
      disbursedAt: isActive ? startDate : undefined,
      expiresAt: isActive ? endDate : undefined,
      createdAt: startDate,
      updatedAt: new Date()
    }
    
    const loan = await Loan.create(loanData)
    loans.push(loan)
    
    console.log(`Created loan for user ${userId} with asset ${borrowAsset.symbol}`)
  }
  
  return loans
}

async function createTransactions(userId: string, assetsByKey: Record<string, any>) {
  console.log(`Creating transactions for user ${userId}...`)
const transactions: any[] = []
  const transactionTypes: Array<'deposit' | 'withdrawal' | 'loan-repayment' | 'interest-payment' | 'interest-accrual' | 'loan-disbursement' | 'liquidation' | 'margin-call' | 'swap' | 'relocation'> = [
    'deposit', 
    'withdrawal', 
    'loan-repayment', 
    'interest-payment', 
    'interest-accrual', 
    'loan-disbursement',
    'swap'
  ]
  const statuses: Array<'pending' | 'completed' | 'failed' | 'confirmed' | 'relocated'> = ['pending', 'completed', 'confirmed']
  
  for (let i = 0; i < 10; i++) {
    const asset = faker.helpers.arrayElement(Object.values(assetsByKey)) as any
    const amount = randomAmount(0.1, 10)
    const txDate = randomDate(new Date(2023, 0, 1), new Date())
    const type = faker.helpers.arrayElement(transactionTypes)
    const status = faker.helpers.arrayElement(statuses)
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`
    
    const txData = {
      user: new mongoose.Types.ObjectId(userId),
      type: type || 'deposit', // Default to deposit if type is undefined
      amount,
      asset: asset.symbol,
      status: status || 'completed', // Default to completed if status is undefined
      network: asset.network,
      txHash,
      grossAmount: amount * 1.01, // 1% fee
      netAmount: amount,
      feePercent: 1.0,
      feeAmount: amount * 0.01,
      createdAt: txDate,
      updatedAt: new Date(),
      // Note: confirmedAt is not part of the schema; omit to avoid strict mode discards
    }
    
    const transaction = await Transaction.create(txData)
    transactions.push(transaction)
  }
  
  console.log(`Created ${transactions.length} transactions for user ${userId}`)
  return transactions
}

async function createNotifications(userId: string) {
  console.log(`Creating notifications for user ${userId}...`)
  const notifications = []
  
  // Define valid notification types based on the Notification model
  const notificationTypes = [
    { type: 'EMAIL', content: 'Your account has been updated' },
    { type: 'SMS', content: 'Your transaction was successful' },
    { type: 'EMAIL', content: 'Please verify your email address' },
    { type: 'SMS', content: 'Your last action could not be completed' }
  ]
  
  for (let i = 0; i < 5; i++) {
    const notificationData = faker.helpers.arrayElement(notificationTypes)
    try {
      const notification = await Notification.create({
        userId: new mongoose.Types.ObjectId(userId),
        type: notificationData.type as 'EMAIL' | 'SMS',
        content: notificationData.content,
        isRead: faker.datatype.boolean()
      })
      
      notifications.push(notification)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Error creating notification: ${errorMessage}`)
    }
  }
  
  console.log(`Created ${notifications.length} notifications for user ${userId}`)
  return notifications
}

async function linkReferrals(users: IUser[]) {
  console.log('Linking referrals among users...')
  // Ensure each user has a Referral document and optionally refer 1-3 other users
  for (const u of users) {
    const userId = new mongoose.Types.ObjectId(String(u._id))
    // Ensure base document exists
    await Referral.updateOne(
      { user: userId },
      { $setOnInsert: { referredUsers: [] } },
      { upsert: true }
    )

    // 60% chance to refer 1-3 other distinct users
    if (Math.random() > 0.4) {
      const others = users.filter((x) => String(x._id) !== String(u._id))
      const chosen = faker.helpers.arrayElements(others, Math.min(3, others.length))
      if (chosen.length) {
        await Referral.updateOne(
          { user: userId },
          { $addToSet: { referredUsers: { $each: chosen.map((c) => new mongoose.Types.ObjectId(String(c._id))) } } }
        )
      }
    }
  }
}

async function main() {
  try {
    // Validate environment
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set')
    }

    // Set environment
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development'
      console.warn('NODE_ENV not set, defaulting to development')
    }

    // Connect to database
    await connectDB()

    // Drop entire database first (per request)
    if (mongoose.connection?.db) {
      const name = await mongoose.connection.db.databaseName
      console.warn(`[seed] Dropping database: ${name}`)
      await mongoose.connection.db.dropDatabase()
    }

    // Get encryption key
    const encryptMnemonic = await ensureEncryptionKey()

    // Seed assets
    const assetsByKey = await seedAssets()

    // Seed users
    const users = await seedUsers(assetsByKey, encryptMnemonic)

    // Link referrals among users based on actual user ids
    await linkReferrals(users)

    console.log('Seeding completed successfully')
  } catch (error) {
    console.error('Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// Run the seeder
main()
