import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { User } from '../models/user.model';
import { CONFIG } from '../config/environment';

/**
 * Attaches the user to res.locals.user if a valid token is present, but never
 * rejects — used for public reads that personalize when logged in (e.g. the
 * feed showing your own reaction). No token / bad token → just proceeds.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token.trim() === '') return next();

  try {
    const decoded = jwt.verify(token, CONFIG.accessTokenSecret) as JwtPayload & { _id: string };
    const user = await User.findById(decoded._id);
    if (user) res.locals.user = user;
  } catch {
    // ignore — treat as anonymous
  }
  next();
}
