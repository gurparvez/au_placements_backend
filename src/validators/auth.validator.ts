import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { isOfficialUniversityEmail, isSupportedUniversity, officialEmailDomainsFor } from '../utils/university';

export const registerSchema = z
  .object({
    auid: z.string().min(1, 'AUID is required').regex(/^\d{5,15}$/, 'AUID must be 5-15 digits'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().max(50).optional(),
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
    university: z.string().min(1, 'University is required'),
    programme: z.string().min(1, 'Programme is required').max(80),
    branch_department: z.string().min(1, 'Branch/Department is required').max(100),
    batch_year: z.coerce
      .number()
      .int('Batch year must be a valid year')
      .min(2000, 'Batch year looks too old')
      .max(2100, 'Batch year looks too far in the future'),
  })
  .superRefine((data, ctx) => {
    if (!isSupportedUniversity(data.university)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['university'],
        message: 'University must be Akal University or Eternal University',
      });
      return;
    }

    if (!isOfficialUniversityEmail(data.email, data.university)) {
      const domains = officialEmailDomainsFor(data.university).join(', ');
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: `Use an official ${data.university} email address${domains ? ` (${domains})` : ''}`,
      });
    }
  });

export const loginSchema = z.object({
  auid: z.string().min(1, 'AUID or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20, 'Verification token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  auid: z.string().min(1, 'AUID is required').optional(),
}).refine((data) => data.email || data.auid, {
  message: 'Email or AUID is required',
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  auid: z.string().min(1, 'AUID is required').optional(),
}).refine((data) => data.email || data.auid, {
  message: 'Email or AUID is required',
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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
