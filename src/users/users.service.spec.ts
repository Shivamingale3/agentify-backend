import type { DatabaseService, Orm } from '@/database/database.service.js';
import type { Models } from '@/database/prisma/contract.js';
import { UsersService } from '@/users/users.service.js';

// A fake Orm exposing only the query-builder calls UsersService uses.
function fakeOrm() {
  const updated = { first: vi.fn() };
  const query = { updateAll: vi.fn(() => updated), first: vi.fn() };
  const User = { create: vi.fn(), where: vi.fn(() => query) };
  return { orm: { public: { User } } as unknown as Orm, User, query, updated };
}

const user = { id: 'u1', email: 'a@example.com' } as Models.public_User;
let defaultOrm: ReturnType<typeof fakeOrm>;
let service: UsersService;

beforeEach(() => {
  defaultOrm = fakeOrm();
  service = new UsersService({ orm: defaultOrm.orm } as DatabaseService);
});

describe('UsersService', () => {
  it('uses the default orm when none is passed', async () => {
    defaultOrm.User.create.mockResolvedValue(user);
    const input = { email: user.email, password: 'hash', emailVerified: false };

    await expect(service.create(input)).resolves.toBe(user);
    expect(defaultOrm.User.create).toHaveBeenCalledWith(input);
  });

  it('uses the passed transaction orm instead of the default', async () => {
    const tx = fakeOrm();
    await service.create({ email: user.email, password: 'hash', emailVerified: false }, tx.orm);

    expect(tx.User.create).toHaveBeenCalledOnce();
    expect(defaultOrm.User.create).not.toHaveBeenCalled();
  });

  it('scopes an update to the user id', async () => {
    defaultOrm.updated.first.mockResolvedValue({ ...user, emailVerified: true });

    await expect(service.update('u1', { emailVerified: true })).resolves.toMatchObject({
      emailVerified: true,
    });
    expect(defaultOrm.User.where).toHaveBeenCalledWith({ id: 'u1' });
    expect(defaultOrm.query.updateAll).toHaveBeenCalledWith({ emailVerified: true });
  });

  it('finds a user by email', async () => {
    defaultOrm.query.first.mockResolvedValue(user);

    await expect(service.findByEmail('a@example.com')).resolves.toBe(user);
    expect(defaultOrm.User.where).toHaveBeenCalledWith({ email: 'a@example.com' });
  });
});
