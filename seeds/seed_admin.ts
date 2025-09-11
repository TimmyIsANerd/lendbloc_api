import 'dotenv/config'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Admin, { AdminRole } from '../src/models/Admin'

async function main() {
  try {
    await connectDB()

    const email = process.env.ADMIN_EMAIL || 'admin@lendbloc.local'
    const username = process.env.ADMIN_USERNAME || 'superadmin'
    const fullName = process.env.ADMIN_FULLNAME || 'Super Admin'
    const secondaryEmail = process.env.ADMIN_SECONDARY_EMAIL || 'admin2@lendbloc.local'
    const role = (process.env.ADMIN_ROLE as AdminRole) || AdminRole.SUPER_ADMIN
    const phoneNumber = process.env.ADMIN_PHONE || '+15550000000'
    const plainPassword = process.env.ADMIN_PASSWORD || 'Admin@12345'

    let admin = await Admin.findOne({ email })
    if (!admin) {
      const passwordHash = await bcrypt.hash(plainPassword, 10)
      admin = await Admin.create({
        role,
        fullName,
        username,
        email,
        secondaryEmail,
        phoneNumber,
        passwordHash,
        isEmailVerified: true,
        isPhoneNumberVerified: true,
      })
      console.log(`Created admin: ${email} (role=${role})`)
    } else {
      // Optionally rotate password if ADMIN_PASSWORD provided
      if (process.env.ADMIN_PASSWORD) {
        const passwordHash = await bcrypt.hash(plainPassword, 10)
        await Admin.updateOne({ _id: admin._id }, { $set: { passwordHash } })
        console.log(`Updated password for admin: ${email}`)
      } else {
        console.log(`Admin already exists: ${email}`)
      }
    }

    // Output minimal access details (email only). Password is known to you/ENV.
    console.log('\nAdmin access (development):')
    console.log(` email: ${email}`)
    console.log(' password: (use ADMIN_PASSWORD env or default Admin@12345)')
    console.log(' login endpoint: POST /api/v1/admin/auth/login')
    console.log(' login body: { "email": "<email>", "password": "<password>" }\n')
  } catch (e) {
    console.error('Admin seeding failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()

