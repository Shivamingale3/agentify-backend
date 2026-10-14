import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '#providers/db.provider.js';
import sessionService from '#services/session.service.js';
import { queryLogOrm } from '../helpers/queryLog.js';

const log = queryLogOrm();
afterAll(() => log.close());

let userId: string;
const session = (id: string, token: string) => ({
  id,
  token,
  userId,
  clientName: 'Chrome',
  clientType: 'web',
});

beforeEach(async () => {
  const user = await db.public.User.create({
    email: 'jane@example.com',
    password: 'hashed',
    emailVerified: true,
    firstName: null,
    lastName: null,
    countryCode: null,
    mobile: null,
  });
  userId = user.id;
});

describe('sessionService (real Postgres)', () => {
  // Login's session write is one atomic statement, so login needs no transaction.
  it('creates or replaces the user session in a single upsert', async () => {
    log.sql.length = 0;
    await sessionService.createSession(session('s1', 'refresh-1'), log.orm);
    await sessionService.createSession(session('s2', 'refresh-2'), log.orm);

    expect(log.sql).toHaveLength(2);
    expect(log.sql[0]).toMatch(/^INSERT INTO .* ON CONFLICT \("userId"\) DO UPDATE/);
    expect(await db.public.Session.all().toArray()).toMatchObject([
      { id: 's2', token: createHash('sha256').update('refresh-2').digest('hex') },
    ]);
  });

  describe('getSessionByRefreshToken', () => {
    beforeEach(async () => {
      await sessionService.createSession(session('s1', 'refresh-1'));
    });

    it('returns the session for the matching id and token, looked up by primary key', async () => {
      log.sql.length = 0;

      expect(
        await sessionService.getSessionByRefreshToken('s1', 'refresh-1', log.orm),
      ).toMatchObject({ id: 's1', userId });
      expect(log.sql).toEqual([expect.stringMatching(/WHERE "sessions"\."id" = \$1 LIMIT 1$/)]);
    });

    it('returns null for a wrong token or an unknown session', async () => {
      expect(await sessionService.getSessionByRefreshToken('s1', 'refresh-2')).toBeNull();
      expect(await sessionService.getSessionByRefreshToken('nope', 'refresh-1')).toBeNull();
    });
  });

  it('deletes the user session', async () => {
    await sessionService.createSession(session('s1', 'refresh-1'));
    await sessionService.deleteSessionByUserId(userId);

    expect(await db.public.Session.first({ userId })).toBeNull();
  });
});
