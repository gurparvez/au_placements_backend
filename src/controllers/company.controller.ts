import { Request, Response } from 'express';
import { FollowService } from '../services/follow.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';

const followService = new FollowService();
const meId = (res: Response) => (res.locals.user ? String(res.locals.user._id) : undefined);

// Public directory of companies (personalized is_following if logged in).
export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await followService.listCompanies(meId(res), page, limit, skip, q);
  res.json({ success: true, data: result.data, pagination: result.pagination });
});

// Public single company profile.
export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  const data = await followService.getCompany(meId(res), String(req.params.id));
  res.json({ success: true, data });
});

export const followCompany = asyncHandler(async (req: Request, res: Response) => {
  const result = await followService.follow(String(res.locals.user._id), String(req.params.id));
  res.json({ success: true, data: result });
});

export const unfollowCompany = asyncHandler(async (req: Request, res: Response) => {
  const result = await followService.unfollow(String(res.locals.user._id), String(req.params.id));
  res.json({ success: true, data: result });
});

export const listFollowing = asyncHandler(async (req: Request, res: Response) => {
  const data = await followService.listFollowing(String(res.locals.user._id));
  res.json({ success: true, data });
});
