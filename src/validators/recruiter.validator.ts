import { z } from 'zod';

export const createRecruiterRequestSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(150),
  cin_registration_number: z.string().min(1, 'CIN/registration number is required').max(80),
  contact_person: z.string().min(1, 'Contact person is required').max(100),
  designation: z.string().min(1, 'Designation is required').max(100),
  official_email: z.string().email('A valid official email is required'),
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Phone must be 10-15 digits'),
  website: z.string().url('Website must be a valid URL').max(200).optional().or(z.literal('')),
  company_brief: z.string().min(20, 'Brief about company must be at least 20 characters').max(2000),
});

export const reviewRecruiterRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_info']),
  decision_note: z.string().max(1000).optional(),
});
