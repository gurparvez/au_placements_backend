import { z } from 'zod';

const university = z.enum(['Akal University', 'Eternal University']);

export const createOpeningSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150),
  description: z.string().min(1, 'Description is required').max(5000),
  type: z.enum(['internship', 'job']),
  work_mode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  location: z.string().max(120).optional(),
  skills: z.array(z.string()).optional(),
  eligible_universities: z.array(university).optional(),
  min_experience: z.number().int().min(0).max(600).optional(),
  stipend_or_salary: z.string().max(120).optional(),
  apply_url: z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional(),
  apply_by: z.string().optional(), // ISO date string
  company: z.string().max(120).optional(), // fallback if recruiter profile missing

  // Eligibility criteria — what the recruiter demands of applicants.
  min_cgpa: z.coerce.number().min(0).max(10).optional(),
  max_backlogs: z.coerce.number().int().min(0).max(50).optional(),
  eligible_departments: z.array(z.string().max(120)).optional(),
  eligible_batches: z.array(z.coerce.number().int().min(1990).max(2100)).optional(),
  allow_placed: z.boolean().optional(),

  tier: z.enum(['regular', 'core', 'dream']).optional(),
  ctc_lpa: z.coerce.number().min(0).optional(),

  rounds: z
    .array(z.object({ name: z.string().min(1).max(80), order: z.coerce.number().int().min(1) }))
    .max(10)
    .optional(),
});

export const roundResultSchema = z.object({
  order: z.coerce.number().int().min(1),
  result: z.enum(['pending', 'cleared', 'failed', 'absent']),
  notes: z.string().max(500).optional(),
});

export const updateOpeningSchema = createOpeningSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field is required to update.' }
);

export const openingStatusSchema = z.object({
  status: z.enum(['open', 'closed']),
});
