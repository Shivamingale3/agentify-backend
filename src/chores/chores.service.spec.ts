import { ChoresService } from '@/chores/chores.service.js';
import type { DatabaseService, Orm } from '@/database/database.service.js';

// A fake Orm exposing only the query-builder calls ChoresService uses.
function fakeOrm() {
  const deleted = { first: vi.fn() };
  const query = { deleteAll: vi.fn(() => deleted), deleteAndCount: vi.fn() };
  const Chore = { create: vi.fn(), first: vi.fn(), where: vi.fn((_filter: unknown) => query) };
  return { orm: { public: { Chore } } as unknown as Orm, Chore, query, deleted };
}

let orm: ReturnType<typeof fakeOrm>;
let service: ChoresService;

beforeEach(() => {
  orm = fakeOrm();
  service = new ChoresService({ orm: orm.orm } as DatabaseService);
});

describe('ChoresService', () => {
  it('deletes a chore by its token and returns the deleted row', async () => {
    orm.deleted.first.mockResolvedValue({ token: 't1' });

    await expect(service.deleteByToken('t1')).resolves.toEqual({ token: 't1' });
    expect(orm.Chore.where).toHaveBeenCalledWith({ token: 't1' });
  });

  it('deleteExpired removes only chores that expired before now', async () => {
    orm.query.deleteAndCount.mockResolvedValue(3);
    const now = Temporal.Instant.from('2026-01-01T00:00:00Z');

    await expect(service.deleteExpired(now)).resolves.toBe(3);

    // Run the where-callback against a fake column to see which comparison it builds.
    const lt = vi.fn();
    const filter = orm.Chore.where.mock.calls[0]?.[0] as (chore: unknown) => void;
    filter({ expiresAt: { lt } });
    expect(lt).toHaveBeenCalledWith(now);
  });
});
