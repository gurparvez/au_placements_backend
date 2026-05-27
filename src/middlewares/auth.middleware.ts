import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';
import { CONFIG } from '../config/environment';

interface IJwtPayload extends JwtPayload {
  _id: string;
  roles: ('student' | 'admin' | 'internal_poster' | 'recruiter' | 'tpo')[];
}

const verifyJwt = asyncHandler(async function (req: Request, res: Response, next: NextFunction) {
  // Get token from cookie OR Authorization header
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token || token.trim() === '') {
    throw new ApiError(401, 'Token is required.');
  }

  let decoded: IJwtPayload;
  try {
    decoded = jwt.verify(token, CONFIG.accessTokenSecret) as IJwtPayload;
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token.');
  }

  // Fetch user
  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(401, 'User does not exist.');
  }

  // Attach to locals
  res.locals.user = user;

  next();
});

const optionalJwt = asyncHandler(async function (req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token || token.trim() === '') {
    return next();
  }

  try {
    const decoded = jwt.verify(token, CONFIG.accessTokenSecret) as IJwtPayload;
    const user = await User.findById(decoded._id);
    if (user) {
      res.locals.user = user;
    }
  } catch {
    // Public endpoints should keep working when an optional token is stale.
  }

  next();
});

export { verifyJwt, optionalJwt };
