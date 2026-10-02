import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { envSchema } from '#validationSchemas/env.schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '../../.env') });

export const env = envSchema.parse(process.env);
