import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  linkedin_url: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  github_url: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  portfolio_url: z.string().url('Invalid portfolio URL').optional().or(z.literal('')),
  open_to: z.string().optional(),
  preferred_field: z.string().optional(),
}).passthrough();
