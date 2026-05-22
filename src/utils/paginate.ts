import { Request } from 'express';

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(req: Request, defaultLimit = 20, maxLimit = 100): PaginationResult {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
