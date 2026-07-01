import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';

const userService = new UserService();

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, message: 'User created', data: user });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await userService.listUsers(page, limit, skip, search);
  res.json({ success: true, data: result.users, pagination: result.pagination });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(String(req.params.id));
  res.json({ success: true, data: user });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(String(req.params.id), req.body);
  res.json({ success: true, message: 'User updated', data: user });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const requesterId = String(res.locals.user._id);
  const result = await userService.deleteUser(String(req.params.id), requesterId);
  res.json({ success: true, message: 'User deleted', data: result });
});
