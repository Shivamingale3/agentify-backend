import { describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const instance = { orm: { public: {} } };
  return { instance, postgres: vi.fn(() => instance) };
});

vi.mock('@prisma/orm-postgres/runtime', () => ({ default: fake.postgres }));
vi.mock('#providers/env.provider.js', () => ({
  env: { DATABASE_URL: 'postgresql://u:p@db.test:5432/app' },
}));

describe('db.provider', () => {
  it('builds the client from the contract and DATABASE_URL and exposes its orm', async () => {
    vi.resetModules();
    const { db, dbInstance } = await import('#providers/db.provider.js');
    const { default: contractJson } = await import('#prisma/contract.json', {
      with: { type: 'json' },
    });

    expect(fake.postgres).toHaveBeenCalledExactlyOnceWith({
      contractJson,
      url: 'postgresql://u:p@db.test:5432/app',
      poolOptions: { connectionTimeoutMillis: 2000 },
    });
    expect(dbInstance).toBe(fake.instance);
    expect(db).toBe(fake.instance.orm);
  });

  it('installs the Temporal global Prisma 8 needs for DateTime', async () => {
    vi.resetModules();
    await import('#providers/db.provider.js');

    expect('Temporal' in globalThis).toBe(true);
  });
});
