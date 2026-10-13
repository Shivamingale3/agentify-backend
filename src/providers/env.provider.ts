import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import envSchema from '#validationSchemas/env.schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '../../.env') });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // The logger depends on env, so report straight to stderr and stop before anything starts.
  const problems = parsed.error.issues.map((issue) => `  - ${issue.message}`).join('\n');
  process.stderr.write(`❌ Invalid environment configuration, fix your .env:\n${problems}\n`);
  process.exit(1);
}

export const env = parsed.data;
