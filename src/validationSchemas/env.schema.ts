import z from 'zod';

export const envSchema = z.object({
  APP_PORT: z.coerce.number().default(5000).nonoptional(),
  APP_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'App enviroment can be development , test or production',
    })
    .nonoptional(),
  DATABASE_URL: z.string().nonoptional(),
  EMAIL_HOST: z.string().nonoptional('EMAIL_HOST is required'),
  EMAIL_PORT: z.coerce.number().nonoptional('EMAIL_PORT is required'),
  EMAIL_FROM: z.string().nonoptional('EMAIL_FROM is required'),
  EMAIL_USER: z.string().nonoptional('EMAIL_USER is required'),
  EMAIL_PASSWORD: z.string().nonoptional('EMAIL_PASSWORD is required'),
  CACHE_URL: z.string().nonoptional('CACHE_URL is required'),
  CACHE_PASS: z.string().nonoptional('CACHE_PASS is required'),
  QUEUE_URL: z.string().nonoptional('QUEUE_URL is required'),
  QUEUE_PASS: z.string().nonoptional('QUEUE_PASS is required'),
});
// .superRefine((val, ctx) => {
//   if (val.AI_PROVIDER === 'groq' && !val.GROQ_API_KEY) {
//     ctx.addIssue({
//       code: 'custom',
//       message: 'GROQ_API_KEY is required when AI_PROVIDER=groq',
//       path: ['GROQ_API_KEY'],
//     });
//   }
//   if (val.AI_PROVIDER === 'gemini' && !val.GEMINI_API_KEY) {
//     ctx.addIssue({
//       code: 'custom',
//       message: 'GEMINI_API_KEY is required when AI_PROVIDER=gemini',
//       path: ['GEMINI_API_KEY'],
//     });
//   }
// });
