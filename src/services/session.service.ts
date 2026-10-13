import type { Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateSessionInput } from '#types/session.types.js';
import { isUniqueViolation } from '#utils/errorGuards.js';
import { logger } from '#utils/logger.js';

class SessionService {
  constructor(private readonly orm: Orm = db) {}

  public async createSession(
    session: CreateSessionInput,
    orm: Orm = this.orm,
    isRetry = false,
  ): Promise<Omit<Models.public_Session, 'user'>> {
    try {
      return await orm.public.Session.create({
        id: session.id,
        token: session.token,
        userId: session.userId,
        clientName: session.clientName,
        clientType: session.clientType,
      });
    } catch (error) {
      if (isUniqueViolation(error) && !isRetry) {
        logger.warn('Duplicate session found for user %s, replacing', session.userId);
        await this.deleteSessionByUserId(session.userId, orm);
        return await this.createSession(session, orm, true);
      }
      logger.error('Failed to create session', { error });
      throw error;
    }
  }

  public async deleteSessionByUserId(userId: string, orm: Orm = this.orm): Promise<void> {
    await orm.public.Session.where({ userId }).delete();
  }
}
const sessionService = new SessionService(db);
export default sessionService;
