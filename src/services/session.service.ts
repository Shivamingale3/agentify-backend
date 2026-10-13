import type { Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateSessionInput } from '#types/session.types.js';

class SessionService {
  constructor(private readonly orm: Orm = db) {}

  // One session per user (userId is @unique): a new login replaces the old session atomically.
  public async createSession(
    session: CreateSessionInput,
    orm: Orm = this.orm,
  ): Promise<Omit<Models.public_Session, 'user'>> {
    const { userId, ...fields } = session;
    return await orm.public.Session.upsert({
      create: session,
      update: fields,
      conflictOn: { userId },
    });
  }

  public async deleteSessionByUserId(userId: string, orm: Orm = this.orm): Promise<void> {
    await orm.public.Session.where({ userId }).delete();
  }
}
const sessionService = new SessionService(db);
export default sessionService;
