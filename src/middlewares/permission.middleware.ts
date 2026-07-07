import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { hasPermission, Permission } from '../config/permissions';
import { Role } from '../models/user.model';

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

/**
 * Guard a route so only users who actually hold one of the given roles may pass.
 * Use it for capabilities intrinsically tied to a role (e.g. only recruiters/
 * companies manage their own company profile). Runs after verifyJwt.
 */
export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user) throw new ApiError(401, 'Unauthorized');
    if (user.status && user.status !== 'active') {
      throw new ApiError(403, 'Your account is not active.');
    }
    const userRoles: Role[] = user.roles ?? [];
    if (!roles.some((r) => userRoles.includes(r))) {
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }
    next();
  };
}
