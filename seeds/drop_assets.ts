import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'
import Asset from '../src/models/Asset'

async function main() {
  try {
    await connectDB()
    const res = await Asset.deleteMany({})
    console.log(`Deleted ${res.deletedCount ?? 0} assets`)
  } catch (e) {
    console.error('Failed to drop assets:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()

