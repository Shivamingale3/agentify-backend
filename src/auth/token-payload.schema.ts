import { z } from 'zod';

/** What the auth JWT carries. Verified tokens are parsed with it, so the guard gets typed data. */
export const authTokenPayloadSchema = z.object({
  userId: z.string('User ID is required'),
  email: z.email('Invalid email'),
  sessionId: z.string('SessionId is required'),
});

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;

/** What the refresh JWT carries. */
export type RefreshTokenPayload = Pick<AuthTokenPayload, 'userId' | 'sessionId'>;
