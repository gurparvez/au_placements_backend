import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const port = parseInt(process.env.PORT || '8000', 10);
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const mediaUrlPath = process.env.MEDIA_URL_PATH || '/media';
const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export const CONFIG = {
  env: process.env.NODE_ENV || 'development',
  port,
  mongoUri: requireEnv('MONGO_URI'),
  accessTokenSecret: requireEnv('ACCESS_TOKEN_SECRET'),
  accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY || '864000', 10),
  corsOrigins: (
    process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174'
  )
    .split(',')
    .map((s) => s.trim()),
  publicBaseUrl,
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  media: {
    root: path.resolve(process.env.MEDIA_ROOT || 'media'),
    urlPath: mediaUrlPath.startsWith('/') ? mediaUrlPath : `/${mediaUrlPath}`,
    publicUrl: `${publicBaseUrl}${mediaUrlPath.startsWith('/') ? mediaUrlPath : `/${mediaUrlPath}`}`,
  },
  ocr: {
    pythonBin: process.env.OCR_PYTHON_BIN || 'python',
    scriptPath: path.resolve(process.env.OCR_SCRIPT_PATH || path.join('scripts', 'ocr_id_card.py')),
    verificationMode: process.env.ID_CARD_VERIFICATION_MODE || 'strict',
  },
  universityEmailDomains: {
    'Akal University': parseList(process.env.AU_EMAIL_DOMAINS || 'akaluniversity.ac.in'),
    'Eternal University': parseList(process.env.EU_EMAIL_DOMAINS || 'eternaluniversity.edu.in'),
  },
};
