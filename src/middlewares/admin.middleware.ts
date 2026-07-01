import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Must run AFTER verifyJwt (which attaches the user to res.locals.user).
 * Allows the request through only if the authenticated user has the 'admin' role.
 */
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user;

  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }

  const roles: string[] = user.roles || [];
  if (!roles.includes('admin')) {
    throw new ApiError(403, 'Admin access required.');
  }

  next();
}
