import crypto from 'node:crypto';
import type { Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateSessionInput } from '#types/session.types.js';

// Store only a digest, so a leaked DB or cache row can't be replayed as a refresh token.
// SHA-256 (not bcrypt) is enough: the token is a long random JWT, not a guessable password.
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

class SessionService {
  constructor(private readonly orm: Orm = db) {}

  // One session per user (userId is @unique): a new login replaces the old session atomically.
  public async createSession(
    session: CreateSessionInput,
    orm: Orm = this.orm,
  ): Promise<Omit<Models.public_Session, 'user'>> {
    const { userId, ...rest } = session;
    const fields = { ...rest, token: hashToken(session.token) };
    return await orm.public.Session.upsert({
      create: { ...fields, userId },
      update: fields,
      conflictOn: { userId },
    });
  }

  public async getSessionByUserId(
    userId: string,
    orm: Orm = this.orm,
  ): Promise<Omit<Models.public_Session, 'user'> | null> {
    return await orm.public.Session.first({ userId });
  }

  public async deleteSessionByUserId(userId: string, orm: Orm = this.orm): Promise<void> {
    await orm.public.Session.where({ userId }).delete();
  }
}
const sessionService = new SessionService(db);
export default sessionService;
