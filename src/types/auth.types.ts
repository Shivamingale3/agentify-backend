import type z from 'zod';
import type registerSchema from '../validationSchemas/auth/register.schema';

export type RegisterDto = z.infer<typeof registerSchema>;
