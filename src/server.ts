import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import routes from './routes';
import cookieParser from "cookie-parser";
import { globalErrorHandler } from './middlewares/errorHandler';
import { CONFIG } from './config/environment';

export function createServer() {
  const app = express();

  // Security headers
  app.use(helmet());

  app.use(
    cors({
      origin: CONFIG.corsOrigins,
      credentials: true,
    })
  );

  app.use(cookieParser());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // General rate limiter for all API routes (skip in development)
  if (CONFIG.env === 'production') {
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api', generalLimiter);
  }

  app.use('/api', routes);

  app.use(globalErrorHandler);

  return app;
}
