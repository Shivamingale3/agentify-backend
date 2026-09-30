import z from 'zod';

export const envSchema = z.object({
  APP_PORT: z.coerce.number().default(5000).nonoptional(),
  APP_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'App enviroment can be development , test or production',
    })
    .nonoptional(),
  DATABASE_URL: z.string().nonoptional(),
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
