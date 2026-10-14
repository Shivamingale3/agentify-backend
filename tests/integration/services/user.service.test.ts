import type { CreateInput } from '@prisma/orm-postgres/orm-client';
import { afterAll, describe, expect, it } from 'vitest';
import type { Contract } from '#prisma/contract.js';
import { db, dbInstance } from '#providers/db.provider.js';
import userService from '#services/user.service.js';
import { isUniqueViolation } from '#utils/errorGuards.js';
import { queryLogOrm } from '../helpers/queryLog.js';

const log = queryLogOrm();
afterAll(() => log.close());

function userInput(
  overrides: Partial<CreateInput<Contract, 'User'>> = {},
): CreateInput<Contract, 'User'> {
  return {
    firstName: 'Jane',
    lastName: null,
    countryCode: null,
    mobile: null,
    email: 'jane@example.com',
    emailVerified: false,
    password: 'hashed',
    ...overrides,
  };
}

describe('userService (real Postgres)', () => {
  it('creates a user with DB defaults and reads it back by id', async () => {
    const created = await userService.createUser(userInput());

    expect(created.id).toBeTypeOf('string');
    expect(created).toMatchObject({ email: 'jane@example.com', emailVerified: false });
    expect(created.createdAt).not.toBeNull();
    expect(await userService.getUserById(created.id)).toMatchObject({
      id: created.id,
      email: 'jane@example.com',
    });
  });

  it('returns null when getting a missing user', async () => {
    expect(await userService.getUserById('does-not-exist')).toBeNull();
  });

  // Regression: where().update() ran SELECT id + UPDATE (2 round trips).
  it('updates a user in a single UPDATE statement', async () => {
    const created = await userService.createUser(userInput());
    log.sql.length = 0;

    const updated = await userService.updateUser(
      { userId: created.id, userData: { emailVerified: true } },
      log.orm,
    );

    expect(updated).toMatchObject({ id: created.id, emailVerified: true });
    expect(log.sql).toHaveLength(1);
    expect(log.sql[0]).toMatch(/^UPDATE .* WHERE "users"\."id" = \$\d+ RETURNING/);
  });

  it('looks a user up by email in a single indexed SELECT', async () => {
    await userService.createUser(userInput());
    log.sql.length = 0;

    expect(await userService.getUserByEmail('jane@example.com', log.orm)).not.toBeNull();
    expect(log.sql).toEqual([expect.stringMatching(/WHERE "users"\."email" = \$1 LIMIT 1$/)]);
  });

  it('updates a user and returns the updated row', async () => {
    const created = await userService.createUser(userInput());

    const updated = await userService.updateUser({
      userId: created.id,
      userData: { emailVerified: true, lastName: 'Doe' },
    });

    expect(updated).toMatchObject({ id: created.id, emailVerified: true, lastName: 'Doe' });
    expect(await db.public.User.first({ id: created.id })).toMatchObject({ emailVerified: true });
  });

  // Regression: updatedAt used to keep its creation time forever (temporal.updatedAt() fixes it).
  it('sets updatedAt on create and bumps it on every update', async () => {
    const created = await userService.createUser(userInput());
    expect(created.updatedAt).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await userService.updateUser({
      userId: created.id,
      userData: { lastName: 'Doe' },
    });

    // Temporal.Instant stringifies to ISO 8601, which Date.parse understands.
    expect(Date.parse(String(updated?.updatedAt))).toBeGreaterThan(
      Date.parse(String(created.updatedAt)),
    );
  });

  it('returns null when updating a missing user', async () => {
    expect(
      await userService.updateUser({ userId: 'does-not-exist', userData: { emailVerified: true } }),
    ).toBeNull();
  });

  it('rejects a duplicate email with a unique violation', async () => {
    await userService.createUser(userInput());

    const error: unknown = await userService.createUser(userInput()).catch((e: unknown) => e);

    expect(isUniqueViolation(error)).toBe(true);
    expect(await db.public.User.all().toArray()).toHaveLength(1);
  });

  it('rejects a duplicate mobile with a unique violation', async () => {
    await userService.createUser(userInput({ mobile: '9999999999', countryCode: '+91' }));

    const error: unknown = await userService
      .createUser(
        userInput({ email: 'other@example.com', mobile: '9999999999', countryCode: '+91' }),
      )
      .catch((e: unknown) => e);

    expect(isUniqueViolation(error)).toBe(true);
  });

  it('allows several users without a mobile (NULLs are not unique-conflicting)', async () => {
    await userService.createUser(userInput());
    await userService.createUser(userInput({ email: 'other@example.com' }));

    expect(await db.public.User.all().toArray()).toHaveLength(2);
  });

  it('rolls back writes made with tx.orm when the transaction callback throws', async () => {
    await expect(
      dbInstance.transaction(async (tx) => {
        const user = await userService.createUser(userInput(), tx.orm);
        await userService.updateUser(
          { userId: user.id, userData: { emailVerified: true } },
          tx.orm,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await db.public.User.all().toArray()).toHaveLength(0);
  });

  it('commits writes made with tx.orm when the callback succeeds', async () => {
    const id = await dbInstance.transaction(async (tx) => {
      const user = await userService.createUser(userInput(), tx.orm);
      return user.id;
    });

    expect(await userService.getUserById(id)).not.toBeNull();
  });
});
