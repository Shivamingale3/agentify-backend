import { z } from 'zod';

/** What register stores (cache + chore row) for a pending email verification. */
export const emailVerificationTaskSchema = z.object({
  token: z.string(),
  email: z.email(),
  userId: z.string(),
  validTill: z.string(),
});

export type EmailVerificationTask = z.infer<typeof emailVerificationTaskSchema>;
