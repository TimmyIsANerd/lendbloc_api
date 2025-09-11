import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import app from '../../../index'
import { connectTestDb, disconnectTestDb, clearDb, signUserToken, bearer } from '../../../tests/test-utils'
import User from '../../models/User'
import Loan from '../../models/Loan'
import SavingsAccount from '../../models/SavingsAccount'
import Transaction from '../../models/Transaction'
import Wallet from '../../models/Wallet'

// Dashboard aggregates multiple collections for a user.

describe('Dashboard Module', () => {
  beforeAll(async () => { await connectTestDb() })
  afterEach(async () => { await clearDb() })
  afterAll(async () => { await disconnectTestDb() })

  it('returns aggregated data for the user', async () => {
    const user = await User.create({ email: 'dash@example.com', kycReferenceId: 'DB1', referralId: 'DR1' })
    await Loan.create({ userId: user._id, collateralAssetId: user._id, collateralAmount: 0, loanAssetId: user._id, loanAmount: 0, ltv: 0, interestRate: 0, termDays: 7, status: 'ACTIVE' } as any)
    await SavingsAccount.create({ userId: user._id, assetId: user._id, balance: 0, apy: 0, termDays: 7, lockStartAt: new Date(), lockEndAt: new Date() })
    await Transaction.create({ user: user._id, type: 'deposit', amount: 1, asset: 'BTC', status: 'confirmed' })
    await Wallet.create({ userId: user._id, assetId: user._id, address: 'addr', encryptedMnemonic: 'enc', network: 'ETH', balance: 0 })

    const token = await signUserToken(String(user._id))
    const res = await app.request('/api/v1/dashboard', { headers: bearer(token) })
    expect([200]).toContain(res.status)
    const data = await res.json()
    expect(data).toHaveProperty('loans')
    expect(data).toHaveProperty('savings')
    expect(data).toHaveProperty('transactions')
    expect(data).toHaveProperty('wallet')
  })
})

