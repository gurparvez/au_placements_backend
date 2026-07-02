import { Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { ReactionService } from '../services/reaction.service';
import { asyncHandler } from '../utils/handler';

const commentService = new CommentService();
const reactionService = new ReactionService();

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const result = await commentService.remove(String(req.params.id), res.locals.user);
  res.json({ success: true, message: 'Comment deleted', data: result });
});

export const reactToComment = asyncHandler(async (req: Request, res: Response) => {
  const result = await reactionService.toggle('comment', String(req.params.id), String(res.locals.user._id), req.body.type);
  res.json({ success: true, data: result });
});
