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
  redisUrl: process.env.REDIS_URL || '',
  cache: {
    // Default TTL (seconds). Acts as a self-healing safety net alongside explicit
    // version-bump invalidation, so a missed invalidation still expires quickly.
    defaultTtl: parseInt(process.env.CACHE_TTL || '60', 10),
    refTtl: parseInt(process.env.CACHE_REF_TTL || '300', 10), // reference data (skills/courses)
  },
  db: {
    maxPoolSize: parseInt(process.env.DB_MAX_POOL || '20', 10),
    minPoolSize: parseInt(process.env.DB_MIN_POOL || '2', 10),
  },
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  observability: {
    slowQueryMs: parseInt(process.env.SLOW_QUERY_MS || '200', 10),
  },
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
