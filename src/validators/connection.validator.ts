import { z } from 'zod';

export const requestConnectionSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export const respondConnectionSchema = z.object({
  accept: z.boolean(),
});
