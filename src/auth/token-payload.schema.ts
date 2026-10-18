import { z } from 'zod';

/** What the auth JWT carries. Verified tokens are parsed with it, so the guard gets typed data. */
export const authTokenPayloadSchema = z.object({
  userId: z.string(),
  email: z.email(),
  sessionId: z.string(),
});

export type AuthTokenPayload = z.infer<typeof authTokenPayloadSchema>;

/** What the refresh JWT carries. */
export type RefreshTokenPayload = Pick<AuthTokenPayload, 'userId' | 'sessionId'>;
