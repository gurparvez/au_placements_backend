import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { asyncHandler } from '../utils/handler';

const messageService = new MessageService();

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const data = await messageService.listConversations(String(res.locals.user._id));
  res.json({ success: true, data });
});

export const startConversation = asyncHandler(async (req: Request, res: Response) => {
  const convo = await messageService.getOrCreate(String(res.locals.user._id), req.body.userId);
  res.json({ success: true, data: convo });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const result = await messageService.listMessages(String(req.params.id), String(res.locals.user._id));
  res.json({ success: true, data: result });
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await messageService.send(String(req.params.id), String(res.locals.user._id), req.body.content);
  res.status(201).json({ success: true, data: message });
});
