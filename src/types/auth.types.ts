import type z from 'zod';
import type registerSchema from '#validationSchemas/auth/register.schema.js';
import { type emailVerificationTaskSchema } from '#validationSchemas/auth/emailVerificationTask.schema.js';

export type RegisterDto = z.infer<typeof registerSchema>;

export type EmailVerificationTask = z.infer<typeof emailVerificationTaskSchema>;
