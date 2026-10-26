import { z } from 'zod';

export const resendVerificationEmailSchema = z.object({
  email: z.string().email(),
});

export type ResendVerificationEmailDto = z.infer<typeof resendVerificationEmailSchema>;
