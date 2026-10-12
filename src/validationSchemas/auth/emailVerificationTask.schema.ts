import z from 'zod';

export const emailVerificationTaskSchema = z.object({
  token: z.string(),
  email: z.email(),
  userId: z.string(),
  validTill: z.string(),
});
