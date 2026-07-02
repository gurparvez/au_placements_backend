import { Request, Response } from 'express';
import { ConnectionService } from '../services/connection.service';
import { asyncHandler } from '../utils/handler';

const connectionService = new ConnectionService();
const meId = (res: Response) => String(res.locals.user._id);

export const requestConnection = asyncHandler(async (req: Request, res: Response) => {
  const conn = await connectionService.request(meId(res), req.body.userId);
  res.status(201).json({ success: true, message: 'Connection request sent', data: conn });
});

export const respondConnection = asyncHandler(async (req: Request, res: Response) => {
  const result = await connectionService.respond(meId(res), String(req.params.id), req.body.accept === true);
  res.json({ success: true, data: result });
});

export const removeConnection = asyncHandler(async (req: Request, res: Response) => {
  const result = await connectionService.remove(meId(res), String(req.params.userId));
  res.json({ success: true, data: result });
});

export const listConnections = asyncHandler(async (req: Request, res: Response) => {
  const data = await connectionService.listConnections(meId(res));
  res.json({ success: true, data });
});

export const listPending = asyncHandler(async (req: Request, res: Response) => {
  const data = await connectionService.listPending(meId(res));
  res.json({ success: true, data });
});

export const connectionStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await connectionService.statusWith(meId(res), String(req.params.userId));
  res.json({ success: true, data });
});
