import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const CONFIG = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  mongoUri: requireEnv('MONGO_URI'),
  accessTokenSecret: requireEnv('ACCESS_TOKEN_SECRET'),
  accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '864000', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim()),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  email: {
    // Resend is used for server-side email (recruiter → student outreach).
    resendApiKey: process.env.RESEND_API_KEY || '',
    // Verified sender. For quick testing Resend allows "onboarding@resend.dev".
    from: process.env.EMAIL_FROM || 'Kalgidhar Placements <onboarding@resend.dev>',
  },
};
