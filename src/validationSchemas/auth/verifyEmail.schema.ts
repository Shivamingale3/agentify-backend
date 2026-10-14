import z from 'zod';

const verifyEmailSchema = z.object({
  key: z.string().trim().min(1, 'Key is required'),
});

export default verifyEmailSchema;
