import { createZodDto } from '@/common/utils/create-zod-dto.js';
import { z } from 'zod';

export const verifyEmailSchema = z.object({
  key: z.string().trim().min(1, 'Key is required'),
});

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
