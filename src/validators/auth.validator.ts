import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const registerSchema = z.object({
  auid: z.string().min(1, 'AUID is required').regex(/^\d{5,15}$/, 'AUID must be 5-15 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
  university: z.string().min(1, 'University is required'),
});

export const loginSchema = z.object({
  auid: z.string().min(1, 'AUID is required'),
  password: z.string().min(1, 'Password is required'),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, errors });
    }
    req.body = result.data;
    next();
  };
}
