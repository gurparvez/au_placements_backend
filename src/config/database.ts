import mongoose from 'mongoose';
import { CONFIG } from './environment';

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(CONFIG.mongoUri);
    console.log(`📦 MongoDB connected | DB HOST: ${connectionInstance.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
};
