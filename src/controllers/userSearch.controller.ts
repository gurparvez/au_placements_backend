import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/handler';

const userService = new UserService();

// For @mention pickers — any authenticated user can search active users by name.
export const searchUsersForMention = asyncHandler(async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const users = await userService.searchForMention(q);
  res.json({ success: true, data: users });
});
