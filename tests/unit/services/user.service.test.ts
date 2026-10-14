import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import userService from '#services/user.service.js';

// A fake Orm exposing only the query-builder calls UserService uses.
function fakeOrm() {
  const updated = { first: vi.fn() };
  const query = { updateAll: vi.fn(() => updated), first: vi.fn() };
  const User = { create: vi.fn(), where: vi.fn(() => query) };
  return { orm: { public: { User } }, User, query, updated };
}

const fake = vi.hoisted(() => ({ db: {} as Record<string, unknown> }));
vi.mock('#providers/db.provider.js', () => ({ db: fake.db }));

const user = { id: 'u1', email: 'a@example.com' } as Models.public_User;
let defaultOrm: ReturnType<typeof fakeOrm>;

beforeEach(() => {
  // Repopulate the module-level `db` the singleton captured, so each test gets fresh fakes.
  defaultOrm = fakeOrm();
  Object.assign(fake.db, defaultOrm.orm);
});

describe('UserService', () => {
  it('is wired to the db orm by default', () => {
    expect(db).toBe(fake.db);
  });

  it('createUser creates through the default orm', async () => {
    defaultOrm.User.create.mockResolvedValue(user);
    const input = { email: user.email, password: 'hash', emailVerified: false };

    await expect(userService.createUser(input)).resolves.toBe(user);
    expect(defaultOrm.User.create).toHaveBeenCalledWith(input);
  });

  it('createUser uses the passed transaction orm instead of the default', async () => {
    const tx = fakeOrm();
    tx.User.create.mockResolvedValue(user);

    await userService.createUser(
      { email: user.email, password: 'hash', emailVerified: false },
      tx.orm as unknown as Orm,
    );

    expect(tx.User.create).toHaveBeenCalledOnce();
    expect(defaultOrm.User.create).not.toHaveBeenCalled();
  });

  it('updateUser scopes the update to the user id and returns the row', async () => {
    defaultOrm.updated.first.mockResolvedValue({ ...user, emailVerified: true });

    await expect(
      userService.updateUser({ userId: 'u1', userData: { emailVerified: true } }),
    ).resolves.toMatchObject({ emailVerified: true });
    expect(defaultOrm.User.where).toHaveBeenCalledWith({ id: 'u1' });
    expect(defaultOrm.query.updateAll).toHaveBeenCalledWith({ emailVerified: true });
  });

  it('updateUser returns null when no row matched', async () => {
    defaultOrm.updated.first.mockResolvedValue(null);
    const tx = fakeOrm();
    tx.updated.first.mockResolvedValue(null);

    await expect(
      userService.updateUser({ userId: 'x', userData: {} }, tx.orm as unknown as Orm),
    ).resolves.toBeNull();
    expect(tx.User.where).toHaveBeenCalledWith({ id: 'x' });
  });

  it('getUserById looks the user up by id', async () => {
    defaultOrm.query.first.mockResolvedValue(user);

    await expect(userService.getUserById('u1')).resolves.toBe(user);
    expect(defaultOrm.User.where).toHaveBeenCalledWith({ id: 'u1' });

    defaultOrm.query.first.mockResolvedValue(null);
    await expect(userService.getUserById('missing')).resolves.toBeNull();
  });

  it('propagates orm errors', async () => {
    defaultOrm.User.create.mockRejectedValue(new Error('db down'));

    await expect(
      userService.createUser({ email: 'e', password: 'p', emailVerified: false }),
    ).rejects.toThrow('db down');
  });
});
