import { Request, Response } from 'express';
import { OutreachService } from '../services/outreach.service';
import { asyncHandler } from '../utils/handler';

const outreachService = new OutreachService();

export const emailStudent = asyncHandler(async (req: Request, res: Response) => {
  const { studentId, subject, body } = req.body;
  const recruiterUserId = String(res.locals.user._id);

  const result = await outreachService.emailStudent(recruiterUserId, studentId, subject, body);
  res.json({ success: true, message: 'Email sent', data: result });
});
