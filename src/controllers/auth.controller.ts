import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/handler';
import { CONFIG } from '../config/environment';

const authService = new AuthService();

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password, firstName, lastName, email, phone, university } = req.body;

  if (!req.file) {
    throw new ApiError(400, 'ID card image is required.');
  }

  const user = await authService.register({
    auid, password, firstName, lastName, email, phone, university,
    idCardBuffer: req.file.buffer,
    idCardMimetype: req.file.mimetype,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully.',
    data: user,
  });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password } = req.body;

  const { token, user } = await authService.login(auid, password);

  const isProduction = CONFIG.env === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: CONFIG.accessTokenExpiry * 1000,
  });

  res.json({ success: true, message: 'Login successful', data: { token, user } });
});

export const updateUserInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const { firstName, lastName, email, phone } = req.body;
  const updated = await authService.updateUserInfo(user._id, { firstName, lastName, email, phone });

  res.json({ success: true, message: 'User info updated', data: updated });
});

export const updatePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Unauthorized');

  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, 'oldPassword and newPassword are required');
  }

  await authService.updatePassword(user._id, oldPassword, newPassword);
  res.json({ success: true, message: 'Password updated successfully' });
});

export const logoutUser = (req: Request, res: Response) => {
  const isProduction = CONFIG.env === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  if (!user) throw new ApiError(401, 'Not authenticated');

  const userData = await authService.getUserById(user._id);
  res.json({ success: true, data: userData });
});
