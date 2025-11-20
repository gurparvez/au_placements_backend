import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';

interface IJwtPayload extends JwtPayload {
  _id: string;
  roles: ('student' | 'admin')[];
}

const verifyJwt = asyncHandler(async function (req: Request, res: Response, next: NextFunction) {
  // Get token from cookie OR Authorization header
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token || token.trim() === '') {
    throw new ApiError(401, 'Token is required.');
  }

  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new ApiError(500, 'Failed to load secret key from env.');
  }

  let decoded: IJwtPayload;
  try {
    decoded = jwt.verify(token, secret) as IJwtPayload;
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

export { verifyJwt };
