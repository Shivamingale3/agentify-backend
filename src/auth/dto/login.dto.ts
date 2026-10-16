import { createZodDto } from '@/common/utils/create-zod-dto.js';
import { z } from 'zod';

export const loginSchema = z.object({
  // Same normalization as registerSchema, or mixed-case input never matches the stored email.
  email: z
    .string({ error: 'Email is invalid' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Email is invalid')),
  // Login only compares against the stored hash. Strength rules belong in registerSchema, where a
  // password is created. Enforcing them here would tell anyone the policy ("must contain an
  // uppercase letter") and lock out existing users if the policy is ever tightened.
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    // Bounds the bcrypt input; no real password is this long. Same message as a wrong password.
    .max(128, 'Invalid credentials'),
});

export class LoginDto extends createZodDto(loginSchema) {}
