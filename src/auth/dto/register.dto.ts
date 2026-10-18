import { createZodDto } from '@/common/utils/create-zod-dto.js';
import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters long')
    .max(50, 'First name must be at most 50 characters long')
    .nullable()
    .optional(),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters long')
    .max(50, 'Last name must be at most 50 characters long')
    .nullable()
    .optional(),
  // Normalize before validating so Jane@x.com and jane@x.com are the same account.
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .nonempty('Email is required')
    .pipe(z.email('Invalid email address')),
  countryCode: z
    .string()
    .regex(/^\+\d{1,3}$/, 'Country code must be in format +XX (e.g. +91)')
    .nullable()
    .optional(),
  mobile: z
    .string()
    .min(4, 'Mobile number must be at least 4 digits')
    .max(15, 'Mobile number must be at most 15 digits')
    .regex(/^\d+$/, 'Mobile number must contain only digits')
    .nullable()
    .optional(),
  // Policy: 8+ chars with an uppercase and lowercase letter, a digit and a symbol. Any
  // non-alphanumeric character counts as a symbol, so password-manager output isn't rejected.
  password: z
    .string({ error: 'Password is required' })
    .nonempty('Password is required')
    .min(8, 'Password must be at least 8 characters long')
    // bcrypt silently ignores everything past 72 *bytes*, so two passwords that differ only after
    // that would both log in. Count bytes, not chars: emoji/accents take 2-4 bytes each.
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export class RegisterDto extends createZodDto(registerSchema) {}
