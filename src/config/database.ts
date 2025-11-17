import mongoose from 'mongoose'
import { CONFIG } from './environment'

export const connectDB = async () => {
  try {
    await mongoose.connect(CONFIG.mongoUri)
    console.log('📦 MongoDB connected')
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err)
    process.exit(1)
  }
}
