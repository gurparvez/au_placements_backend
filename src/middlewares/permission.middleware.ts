import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { hasPermission, Permission } from '../config/permissions';

/**
 * Guard a route by a permission string. Must run AFTER verifyJwt (which puts the
 * user on res.locals.user). Denies non-active users automatically.
 */
export function requirePermission(permission: Permission) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user) throw new ApiError(401, 'Unauthorized');
    if (user.status && user.status !== 'active') {
      throw new ApiError(403, 'Your account is not active.');
    }
    if (!hasPermission(user, permission)) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  };
}
