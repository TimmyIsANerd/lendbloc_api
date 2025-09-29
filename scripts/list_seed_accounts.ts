import 'dotenv/config'
import mongoose from 'mongoose'

async function main() {
  // Import lazily to avoid side logging from connectDB helper
  const { default: User } = await import('../src/models/User')

  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('MONGO_URI is not set')
    process.exit(1)
  }

  try {
    await mongoose.connect(uri)

    const adminUser = await User.findOne({ kycReferenceId: 'KYC-ADMIN-001' }).select('email kycReferenceId').lean()
    const fixedUsers = await User.find({ kycReferenceId: { $in: ['KYC-FIX-001', 'KYC-FIX-002'] } }).select('email kycReferenceId').sort({ kycReferenceId: 1 }).lean()
    const generatedUsers = await User.find({ kycReferenceId: { $regex: /^KYC-USER-\d{4}$/ } }).select('email kycReferenceId').sort({ kycReferenceId: 1 }).lean()

    const payload = {
      admin: adminUser ? [{ email: adminUser.email }] : [],
      fixed: fixedUsers.map((u: any) => ({ email: u.email, kyc: u.kycReferenceId })),
      generated: generatedUsers.map((u: any) => ({ email: u.email, kyc: u.kycReferenceId })),
      defaults: {
        adminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
        adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345',
        userPassword: process.env.DEFAULT_USER_PASSWORD || 'User@12345',
      }
    }

    // Markers to allow clean parsing
    console.log('===BEGIN_SEED_ACCOUNTS_JSON===')
    console.log(JSON.stringify(payload))
    console.log('===END_SEED_ACCOUNTS_JSON===')
  } catch (e) {
    console.error('List seed accounts failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect().catch(() => {})
  }
}

main()