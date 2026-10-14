import type z from 'zod';
import type registerSchema from '#validationSchemas/auth/register.schema.js';
import type loginSchema from '#validationSchemas/auth/login.schema.js';
import type { emailVerificationTaskSchema } from '#validationSchemas/auth/emailVerificationTask.schema.js';
import type authTokenPayloadSchema from '#validationSchemas/auth/authPayload.schema.js';
import type refreshTokenPayloadSchema from '#validationSchemas/auth/refreshPayload.schema.js';
import type deviceHeadersSchema from '#validationSchemas/auth/deviceHeaders.schema.js';
import type verifyEmailSchema from '#validationSchemas/auth/verifyEmail.schema.js';

export type RegisterDto = z.infer<typeof registerSchema>;

export type LoginDto = z.infer<typeof loginSchema>;

export type EmailVerificationTask = z.infer<typeof emailVerificationTaskSchema>;

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;
export type ExtraDeviceHeaders = z.infer<typeof deviceHeadersSchema>;
export type VarifyEmailPayload = z.infer<typeof verifyEmailSchema>;
