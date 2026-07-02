import { z } from 'zod';

export const sendOutreachSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Message is required').max(5000),
});
