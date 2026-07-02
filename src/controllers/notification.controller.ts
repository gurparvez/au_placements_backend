import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { asyncHandler } from '../utils/handler';
import { getPagination } from '../utils/paginate';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req);
  const result = await notificationService.list(String(res.locals.user._id), page, limit, skip);
  res.json({ success: true, data: result.items, unread: result.unread, pagination: result.pagination });
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.unreadCount(String(res.locals.user._id));
  res.json({ success: true, data: { count } });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const unread = await notificationService.markRead(String(res.locals.user._id), req.body?.ids);
  res.json({ success: true, data: { unread } });
});
