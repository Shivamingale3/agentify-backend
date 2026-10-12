import z from 'zod';
import type { JobPayload } from '#types/jobs.types.js';

const mailMessageSchema = z.object({
  to: z.email(),
  subject: z.string().min(1),
  text: z.string(),
  html: z.string().exactOptional(),
});

const buildJobDataSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
});

/** Validates job.data read back from Redis. `satisfies` keeps it in sync with JobPayload. */
export const jobPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), data: mailMessageSchema }),
  z.object({ type: z.literal('build'), data: buildJobDataSchema }),
]) satisfies z.ZodType<JobPayload>;
