import mongoose from 'mongoose';

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Error: MONGO_URI is not set');
    process.exit(1);
  }

  // Helpful connection logs
  mongoose.connection.on('connected', () => {
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
  // 'reconnected' may not fire on all drivers but safe to attach
  // @ts-ignore
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err?.message || err);
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 60000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 120000),
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 45000),
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error?.message || error}`);
    process.exit(1);
  }
};

export default connectDB;
