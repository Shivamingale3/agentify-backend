import { envSchema, type Env } from '@/config/env/env.schema.js';
import z from 'zod';

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}
