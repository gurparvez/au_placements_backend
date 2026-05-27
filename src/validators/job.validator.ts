import { z } from 'zod';

const eligibilitySchema = z
  .object({
    min_cgpa: z.coerce.number().min(0).max(10).optional(),
    allowed_branches: z.array(z.string()).optional(),
    allowed_programmes: z.array(z.string()).optional(),
    allowed_batch_years: z.array(z.coerce.number().int()).optional(),
    allowed_universities: z.array(z.enum(['Akal University', 'Eternal University'])).optional(),
    no_active_backlogs: z.boolean().optional(),
    max_backlogs: z.coerce.number().int().min(0).optional(),
  })
  .default({});

export const createJobSchema = z.object({
  target_university: z.enum(['Akal University', 'Eternal University', 'Both']).default('Both'),
  company_name: z.string().min(1, 'Company name is required').max(150),
  title: z.string().min(1, 'Title is required').max(150),
  role: z.string().max(150).optional(),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['FullTime', 'Internship', 'Project', 'Campus']),
  ctc_stipend: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  eligibility: eligibilitySchema,
  deadline: z.coerce.date(),
  status: z.enum(['Draft', 'Active', 'Closed']).optional(),
  contact_person: z.string().max(100).optional(),
});

export const updateJobSchema = createJobSchema.partial();

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    'Applied',
    'Shortlisted',
    'InterviewScheduled',
    'Selected',
    'Rejected',
    'Offer Accepted',
    'Offer Declined',
  ]),
  note: z.string().max(500).optional(),
});

export const eligibilityOverrideSchema = z.object({
  userId: z.string().min(1, 'Student user id is required'),
  eligible: z.boolean(),
  reason: z.string().min(1, 'Override reason is required').max(500),
});
