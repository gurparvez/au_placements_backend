import { z } from 'zod';

export const startConversationSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message is required').max(5000),
});

export const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
});
