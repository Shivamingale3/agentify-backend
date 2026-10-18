import { SessionService } from '@/auth/session.service.js';
import type { DatabaseService, Orm } from '@/database/database.service.js';
import { createHash } from 'node:crypto';

function fakeOrm() {
  const Session = { upsert: vi.fn() };
  return { orm: { public: { Session } } as unknown as Orm, Session };
}

describe('SessionService', () => {
  it('stores a SHA-256 digest of the refresh token, never the token itself', async () => {
    const { orm, Session } = fakeOrm();
    const service = new SessionService({ orm } as DatabaseService);
    const input = {
      id: 's1',
      userId: 'u1',
      token: 'refresh-jwt',
      clientName: null,
      clientType: null,
    };

    await service.create(input);

    const digest = createHash('sha256').update('refresh-jwt').digest('hex');
    expect(Session.upsert).toHaveBeenCalledWith({
      create: { id: 's1', userId: 'u1', token: digest, clientName: null, clientType: null },
      update: { id: 's1', token: digest, clientName: null, clientType: null },
      conflictOn: { userId: 'u1' },
    });
    expect(JSON.stringify(Session.upsert.mock.calls)).not.toContain('refresh-jwt');
  });
});
