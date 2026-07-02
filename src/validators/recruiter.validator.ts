import { z } from 'zod';

const urlOrEmpty = z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional();

export const recruiterRequestSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  company: z.string().min(1, 'Company name is required').max(120),
  designation: z.string().max(80).optional(),
  company_website: urlOrEmpty,
  industry: z.string().max(80).optional(),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).optional(),
  location: z.string().max(120).optional(),
  linkedin_url: urlOrEmpty,
  about: z.string().max(1000).optional(),
  work_email: z.union([z.string().email(), z.literal('')]).optional(),
});

// Admin-created recruiter uses the same fields (created already-approved).
export const adminCreateRecruiterSchema = recruiterRequestSchema;

export const rejectRecruiterSchema = z.object({
  reason: z.string().max(500).optional(),
});
