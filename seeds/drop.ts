import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db'

async function main() {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not set. Please configure your database connection string in the environment.')
      process.exit(1)
    }

    await connectDB()

    const db = mongoose.connection.db
    if (!db) {
      console.error('No DB connection available to drop.')
      process.exit(1)
    }

    const name = await db.databaseName
    await db.dropDatabase()
    console.log(`Dropped database: ${name}`)
  } catch (e) {
    console.error('Drop failed:', e)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

main()

