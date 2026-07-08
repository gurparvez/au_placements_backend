import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Per-request access log with a correlation id and latency. The id is echoed in
 * the `X-Request-Id` response header and available at `res.locals.reqId` so
 * errors/slow queries can be traced back to a single request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();

  const id = randomUUID();
  res.locals.reqId = id;
  res.setHeader('X-Request-Id', id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ reqId: id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms }, 'request');
  });

  next();
}
