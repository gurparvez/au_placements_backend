import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8000,
  mongoUri: process.env.MONGO_URI || '',
};
