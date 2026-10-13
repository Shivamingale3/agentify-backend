import z from 'zod';

const authTokenPayloadSchema = z.object({
  userId: z.string('User ID is required'),
  email: z.email('Invalid email'),
  sessionId: z.string('SessionId is required'),
});
export default authTokenPayloadSchema;
