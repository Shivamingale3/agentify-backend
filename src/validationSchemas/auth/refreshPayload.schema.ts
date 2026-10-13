import z from 'zod';

const refreshTokenPayloadSchema = z.object({
  sessionId: z.string('Session ID is required'),
  userId: z.string('User ID is required'),
});

export default refreshTokenPayloadSchema;
