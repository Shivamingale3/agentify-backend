import type { Models } from '#prisma/contract.js';

export type CreateSessionInput = Pick<
  Models.public_Session,
  'token' | 'userId' | 'clientName' | 'clientType' | 'id'
>;
