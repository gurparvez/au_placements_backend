import { z } from 'zod';

const universityEnum = z.enum(['Akal University', 'Eternal University']);
const rolesEnum = z.array(z.enum(['student', 'admin'])).nonempty('At least one role is required');

export const createUserSchema = z.object({
  auid: z.string().min(1, 'AUID is required').regex(/^\d{5,15}$/, 'AUID must be 5-15 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
  university: universityEnum,
  roles: rolesEnum.optional(),
});

export const updateUserSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().max(50).optional(),
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits').optional(),
    university: universityEnum.optional(),
    roles: rolesEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update.',
  });
