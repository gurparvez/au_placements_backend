import mongoose from 'mongoose';
import { CONFIG } from './environment';
import { registerQueryTiming } from './observability';

export const connectDB = async () => {
  try {
    // Register the slow-query timer BEFORE any model compiles so it applies globally.
    registerQueryTiming();

    // Building indexes on every boot is expensive and can stall a busy prod node;
    // do it in dev, and run index sync deliberately in prod.
    mongoose.set('autoIndex', CONFIG.env !== 'production');

    const connectionInstance = await mongoose.connect(CONFIG.mongoUri, {
      // Pool sized for concurrency — reused sockets instead of a connect per request.
      maxPoolSize: CONFIG.db.maxPoolSize,
      minPoolSize: CONFIG.db.minPoolSize,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log(`📦 MongoDB connected | DB HOST: ${connectionInstance.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
};
