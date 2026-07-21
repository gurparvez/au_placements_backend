import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  linkedin_url: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  github_url: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  portfolio_url: z.string().url('Invalid portfolio URL').optional().or(z.literal('')),
  open_to: z.string().optional(),
  preferred_field: z.string().optional(),

  // Academic record — drives TPC reporting (department / course / batch cohorts).
  department: z.string().max(120).optional().or(z.literal('')),
  course: z.string().optional().or(z.literal('')),
  batch_year: z.coerce.number().int().min(1990).max(2100).optional(),

  // Opting in/out of placements is the student's own choice.
  placement_intent: z
    .enum(['placement', 'higher_studies', 'competitive_exam', 'entrepreneurship', 'family_business', 'not_interested', 'deferred'])
    .optional(),
  opted_out_reason: z.string().max(300).optional().or(z.literal('')),

  // NOTE: cgpa / backlogs / readiness scores are deliberately absent — they are
  // TPO-owned and stripped server-side in StudentService.updateProfile.
}).passthrough();
