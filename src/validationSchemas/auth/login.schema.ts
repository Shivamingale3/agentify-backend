import z from 'zod';

const loginSchema = z.object({
  // Same normalization as registerSchema, or mixed-case input never matches the stored email.
  email: z
    .string({ error: 'Email is invalid' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Email is invalid')),
  password: z
    .string({ error: 'Password is required' })
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .min(8, 'Password must be at least 8 characters long'),
});

export default loginSchema;
