import crypto from 'node:crypto';
import type { Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateSessionInput } from '#types/session.types.js';

// Store only a digest, so a leaked DB or cache row can't be replayed as a refresh token.
// SHA-256 (not bcrypt) is enough: the token is a long random JWT, not a guessable password.
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// One session per user, so the cache is keyed by user: a new login overwrites the old entry, with no
// need to read the previous session id first (that read was the reason login needed a transaction).
export const sessionCacheKey = (userId: string): string => `session:${userId}`;

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

  /**
   * For the refresh flow: look the session up by its id (from the refresh JWT), then compare token
   * hashes. Querying by token instead would be a sequential scan (no index on token): 4.6 ms vs
   * 0.03 ms on 100k sessions, and the gap grows with the table. See docs/Experience.md.
   */
  public async getSessionByRefreshToken(
    sessionId: string,
    refreshToken: string,
    orm: Orm = this.orm,
  ): Promise<Omit<Models.public_Session, 'user'> | null> {
    const session = await orm.public.Session.first({ id: sessionId });
    if (!session) {
      return null;
    }
    const expected = Buffer.from(session.token, 'hex');
    const actual = Buffer.from(hashToken(refreshToken), 'hex');
    // Constant-time compare, so response timing doesn't leak how much of the hash matched.
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
      ? session
      : null;
  }

  public async deleteSessionByUserId(userId: string, orm: Orm = this.orm): Promise<void> {
    // deleteAndCount(): one DELETE. delete() would first SELECT the id (2 round trips).
    await orm.public.Session.where({ userId }).deleteAndCount();
  }
}
const sessionService = new SessionService(db);
export default sessionService;
