import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // If it's our custom ApiError, use its status code
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors.length > 0 && { errors: err.errors }),
    });
  }

  // Default to 500 for unknown errors
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Internal Server Error';

  logger.error(
    { reqId: res.locals.reqId, method: req.method, path: req.path, status: statusCode, err: err?.message, stack: err?.stack },
    'unhandled error'
  );

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
