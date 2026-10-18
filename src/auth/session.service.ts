import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Models } from '@/database/prisma/contract.js';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type Session = Omit<Models.public_Session, 'user'>;
export type CreateSessionInput = Pick<
  Models.public_Session,
  'id' | 'userId' | 'token' | 'clientName' | 'clientType'
>;

// Store only a digest, so a leaked DB or cache row can't be replayed as a refresh token.
// SHA-256 (not bcrypt) is enough: the token is a long random JWT, not a guessable password.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// One session per user, so the cache is keyed by user: a new login overwrites the old entry, with no
// need to read the previous session id first.
export const sessionCacheKey = (userId: string): string => `session:${userId}`;

// Each method takes an optional `orm`: pass `tx.orm` to run it inside a transaction.
@Injectable()
export class SessionService {
  constructor(private readonly db: DatabaseService) {}

  // One session per user (userId is @unique): a new login replaces the old session atomically.
  async create(session: CreateSessionInput, orm: Orm = this.db.orm): Promise<Session> {
    const { userId, ...rest } = session;
    const fields = { ...rest, token: hashToken(session.token) };
    return await orm.public.Session.upsert({
      create: { ...fields, userId },
      update: fields,
      conflictOn: { userId },
    });
  }

  async deleteByUserId(userId: string, orm: Orm = this.db.orm): Promise<void> {
    // deleteAndCount(): one DELETE. delete() would first SELECT the id (2 round trips).
    await orm.public.Session.where({ userId }).deleteAndCount();
  }
}
