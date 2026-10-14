import z from 'zod';

// Missing and empty ("KEY=") are both treated as absent.
const requiredString = (name: string): z.ZodString =>
  z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const requiredNumber = (name: string): z.ZodCoercedNumber =>
  z.coerce
    .number({ error: `${name} must be a number` })
    .int(`${name} must be an integer`)
    .positive(`${name} is required`);

const envSchema = z.object({
  APP_PORT: requiredNumber('APP_PORT').default(5000),
  APP_ENV: z.enum(['development', 'test', 'production'], {
    error: 'APP_ENV is required and must be development, test or production',
  }),
  APP_URL: requiredString('APP_URL'),
  FRONTEND_URL: requiredString('FRONTEND_URL'),
  // Comma separated, e.g. "http://localhost:3000,https://app.example.com".
  // Normalised to bare origins so "https://app.example.com/" still matches the Origin header.
  ALLOWED_ORIGINS: requiredString('ALLOWED_ORIGINS')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    // http(s) only: other schemes (file:, javascript:, a bare "localhost:3000") have origin "null",
    // which would let sandboxed iframes and file:// pages make credentialed requests.
    .pipe(
      z
        .array(
          z.url({
            protocol: /^https?$/,
            error: 'ALLOWED_ORIGINS must be a comma separated list of http(s) URLs',
          }),
        )
        .min(1),
    )
    .transform((origins) => origins.map((origin) => new URL(origin).origin)),
  DATABASE_URL: requiredString('DATABASE_URL'),
  EMAIL_HOST: requiredString('EMAIL_HOST'),
  EMAIL_PORT: requiredNumber('EMAIL_PORT'),
  EMAIL_FROM: requiredString('EMAIL_FROM'),
  EMAIL_USER: requiredString('EMAIL_USER'),
  EMAIL_PASSWORD: requiredString('EMAIL_PASSWORD'),
  CACHE_URL: requiredString('CACHE_URL'),
  CACHE_PASS: requiredString('CACHE_PASS'),
  QUEUE_HOST: requiredString('QUEUE_HOST'),
  QUEUE_PORT: requiredNumber('QUEUE_PORT'),
  QUEUE_PASS: requiredString('QUEUE_PASS'),
  // Jobs each worker process runs in parallel. Spawn more processes to scale out.
  WORKER_CONCURRENCY: requiredNumber('WORKER_CONCURRENCY').default(5),
  JWT_SECRET: requiredString('JWT_SECRET'),
  AUTH_COOKIE_NAME: z.string().default('c_auth_value'),
  REFRESH_COOKIE_NAME: z.string().default('c_refresh_value'),
  REFRESH_EXPIRY: requiredNumber('REFRESH_EXPIRY').default(86400),
  AUTH_EXPIRY: requiredNumber('AUTH_EXPIRY').default(600),
});

type Env = z.infer<typeof envSchema>;

export { envSchema, type Env };
