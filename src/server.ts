import cors from 'cors';
import express from 'express';
import compression from 'compression';
import rateLimit, { Options as RateLimitOptions } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import helmet from 'helmet';
import routes from './routes';
import cookieParser from 'cookie-parser';
import { globalErrorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { CONFIG } from './config/environment';
import { redis } from './config/redis';

// Shared rate-limit store: distributed via Redis when configured (works across
// many instances), otherwise per-process in-memory. Falls back automatically.
function makeLimiter(opts: Partial<RateLimitOptions>) {
  const store = redis
    ? new RedisStore({ sendCommand: (...args: string[]) => (redis as any).call(...args) })
    : undefined;
  return rateLimit({ standardHeaders: true, legacyHeaders: false, store, ...opts });
}

export function createServer() {
  const app = express();

  // Behind a load balancer / reverse proxy — trust it for correct client IPs.
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // gzip responses — big win on JSON payloads (feed, directories, openings).
  app.use(compression());

  app.use(
    cors({
      origin: CONFIG.corsOrigins,
      credentials: true,
    })
  );

  app.use(cookieParser());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Access log with correlation id + latency (skips /health).
  app.use(requestLogger);

  // Cheap health check for load balancers — before rate limiting.
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // General rate limiter for all API routes (skip in development).
  if (CONFIG.env === 'production') {
    app.use('/api', makeLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: 'Too many requests, please try again later.' },
    }));
  }

  app.use('/api', routes);

  app.use(globalErrorHandler);

  return app;
}
