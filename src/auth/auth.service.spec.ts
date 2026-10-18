import { AuthService } from '@/auth/auth.service.js';
import type { DeviceInfo } from '@/auth/decorators/device-headers.decorator.js';
import type { EmailVerificationTask } from '@/auth/email-verification-task.schema.js';
import type { SessionService } from '@/auth/session.service.js';
import type { CacheService } from '@/cache/cache.service.js';
import type { ChoresService } from '@/chores/chores.service.js';
import type { Env } from '@/config/env/env.schema.js';
import type { DatabaseService } from '@/database/database.service.js';
import type { Models } from '@/database/prisma/contract.js';
import type { QueueService } from '@/queue/queue.service.js';
import type { UsersService } from '@/users/users.service.js';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { ZodError } from 'zod';

// Unit test: every dependency is a fake, so this only exercises AuthService's own logic.
const env: Partial<Env> = {
  FRONTEND_URL: 'https://app.test',
  AUTH_EXPIRY: 600,
  REFRESH_EXPIRY: 86_400,
};
const user = { id: 'user_1', email: 'a@example.com' } as Models.public_User;
const chore = { token: 'tok' } as Models.public_Chore;
const noDevice: DeviceInfo = { clientName: undefined, clientType: undefined };

function payload(overrides: Partial<EmailVerificationTask> = {}): EmailVerificationTask {
  return {
    token: 'tok',
    email: user.email,
    userId: user.id,
    validTill: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function setup() {
  const deps = {
    // Run the callback immediately with a fake tx, like a transaction that always commits.
    transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ orm: {} })),
    users: { create: vi.fn(), update: vi.fn(), findByEmail: vi.fn() },
    chores: { create: vi.fn(), findByToken: vi.fn(), deleteByToken: vi.fn() },
    cache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
    queue: { enqueue: vi.fn() },
    sessions: { create: vi.fn(), deleteByUserId: vi.fn() },
    jwt: { signAsync: vi.fn((p: object) => Promise.resolve(`jwt:${JSON.stringify(p)}`)) },
  };
  const service = new AuthService(
    { get: (key: keyof Env) => env[key] } as unknown as ConfigService<Env, true>,
    { client: { transaction: deps.transaction } } as unknown as DatabaseService,
    deps.jwt as unknown as JwtService,
    deps.users as unknown as UsersService,
    deps.sessions as unknown as SessionService,
    deps.chores as unknown as ChoresService,
    deps.cache as unknown as CacheService,
    deps.queue as unknown as QueueService,
  );
  return { service, ...deps };
}

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});

describe('AuthService.register', () => {
  const dto = { email: user.email, password: 'Passw0rd!' };

  beforeEach(() => {
    t.users.create.mockResolvedValue(user);
  });

  it('creates the user and chore, then caches the token and enqueues the email', async () => {
    await t.service.register(dto);

    expect(t.users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, emailVerified: false }),
      expect.anything(),
    );
    const created = t.users.create.mock.calls[0]?.[0] as { password: string } | undefined;
    expect(created?.password).not.toBe('Passw0rd!'); // stored hashed
    expect(t.chores.create).toHaveBeenCalledOnce();
    expect(t.cache.set).toHaveBeenCalledOnce();
    expect(t.queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email', data: expect.objectContaining({ to: user.email }) }),
    );
  });

  it('maps a unique violation to 409 and sends nothing', async () => {
    t.users.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { kind: 'sql_query', sqlState: '23505' }),
    );

    await expect(t.service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(t.queue.enqueue).not.toHaveBeenCalled();
  });

  it('copies optional profile fields, and the phone only when both parts are present', async () => {
    await t.service.register({
      ...dto,
      firstName: 'Ada',
      lastName: 'Lovelace',
      countryCode: '+44',
      mobile: '7000000000',
    });
    await t.service.register({ ...dto, mobile: '7000000000' });

    expect(t.users.create.mock.calls[0]?.[0]).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      countryCode: '+44',
      mobile: '7000000000',
    });
    expect(t.users.create.mock.calls[1]?.[0]).toMatchObject({
      firstName: null,
      lastName: null,
      countryCode: null,
      mobile: null,
    });
  });

  it('drops a countryCode sent without a mobile', async () => {
    await t.service.register({ ...dto, countryCode: '+91' });

    expect(t.users.create.mock.calls[0]?.[0]).toMatchObject({ countryCode: null, mobile: null });
  });

  it('stores one random token in the chore, the cache and the emailed link', async () => {
    await t.service.register(dto);

    const created = t.chores.create.mock.calls[0]?.[0] as { token: string } | undefined;
    const token = created?.token ?? '';
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(t.chores.create.mock.calls[0]?.[0]).toMatchObject({
      taskType: 'EMAIL_VERIFICATION',
      taskData: { token, email: user.email, userId: user.id },
    });
    expect(t.cache.set).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ token, userId: user.id }),
      60 * 60 * 1000,
    );
    const job = t.queue.enqueue.mock.calls[0]?.[0] as { data: { html: string } };
    expect(job.data.html).toContain(`https://app.test/verify-email?key=${token}`);
  });

  it('rethrows non-unique errors unchanged and sends nothing', async () => {
    const error = new Error('db down');
    t.chores.create.mockRejectedValue(error);

    await expect(t.service.register(dto)).rejects.toBe(error);
    expect(t.cache.set).not.toHaveBeenCalled();
    expect(t.queue.enqueue).not.toHaveBeenCalled();
  });

  it('runs the user and chore writes in one transaction', async () => {
    await t.service.register(dto);

    expect(t.transaction).toHaveBeenCalledOnce();
  });
});

describe('AuthService.verifyEmail', () => {
  it('verifies the user, consumes the chore and clears the cache', async () => {
    t.cache.get.mockResolvedValue(payload());
    t.chores.deleteByToken.mockResolvedValue(chore);
    t.users.update.mockResolvedValue({ ...user, emailVerified: true });

    await t.service.verifyEmail('tok');

    expect(t.users.update).toHaveBeenCalledWith(
      user.id,
      { emailVerified: true },
      expect.anything(),
    );
    expect(t.cache.del).toHaveBeenCalledWith('tok');
  });

  it('falls back to the DB chore on a cache miss', async () => {
    t.cache.get.mockResolvedValue(null);
    t.chores.findByToken.mockResolvedValue({ ...chore, taskData: payload() });
    t.chores.deleteByToken.mockResolvedValue(chore);
    t.users.update.mockResolvedValue(user);

    await t.service.verifyEmail('tok');

    expect(t.users.update).toHaveBeenCalledOnce();
  });

  it('rejects an unknown token', async () => {
    t.cache.get.mockResolvedValue(null);
    t.chores.findByToken.mockResolvedValue(null);

    await expect(t.service.verifyEmail('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(t.users.update).not.toHaveBeenCalled();
  });

  it('rejects an expired token and removes it right away', async () => {
    t.cache.get.mockResolvedValue(payload({ validTill: new Date(Date.now() - 1).toISOString() }));

    await expect(t.service.verifyEmail('tok')).rejects.toThrow('Token expired');
    expect(t.chores.deleteByToken).toHaveBeenCalledWith('tok');
    expect(t.cache.del).toHaveBeenCalledWith('tok');
    expect(t.users.update).not.toHaveBeenCalled();
  });

  it('rejects a token that was already used', async () => {
    t.cache.get.mockResolvedValue(payload());
    t.chores.deleteByToken.mockResolvedValue(null);

    await expect(t.service.verifyEmail('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(t.users.update).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists and keeps the cache entry', async () => {
    t.cache.get.mockResolvedValue(payload());
    t.chores.deleteByToken.mockResolvedValue(chore);
    t.users.update.mockResolvedValue(null);

    await expect(t.service.verifyEmail('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(t.cache.del).not.toHaveBeenCalled();
  });

  it('rejects a DB chore whose data does not match the schema', async () => {
    t.cache.get.mockResolvedValue(null);
    t.chores.findByToken.mockResolvedValue({ ...chore, taskData: { token: 'tok' } });

    await expect(t.service.verifyEmail('tok')).rejects.toBeInstanceOf(ZodError);
    expect(t.chores.deleteByToken).not.toHaveBeenCalled();
  });

  it('rethrows unexpected errors unchanged', async () => {
    const error = new Error('db down');
    t.cache.get.mockResolvedValue(payload());
    t.chores.deleteByToken.mockRejectedValue(error);

    await expect(t.service.verifyEmail('tok')).rejects.toBe(error);
    expect(t.cache.del).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  const credentials = { email: user.email, password: 'Passw0rd!' };
  let verifiedUser: Models.public_User;

  beforeAll(async () => {
    verifiedUser = { ...user, emailVerified: true, password: await hash('Passw0rd!', 4) };
  });

  beforeEach(() => {
    t.users.findByEmail.mockResolvedValue(verifiedUser);
    t.sessions.create.mockImplementation((data: unknown) => Promise.resolve(data));
  });

  it('caches the new session under the user key with the refresh-token TTL', async () => {
    await t.service.login(credentials, noDevice);

    const created = t.sessions.create.mock.calls[0]?.[0] as { id: string };
    expect(t.cache.set).toHaveBeenCalledWith(
      `session:${user.id}`,
      expect.objectContaining({ id: created.id, userId: user.id }),
      86_400 * 1000,
    );
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const wrongPassword = t.service.login({ ...credentials, password: 'Wr0ngPass!' }, noDevice);
    await expect(wrongPassword).rejects.toThrow('Invalid credentials');

    t.users.findByEmail.mockResolvedValue(null);
    await expect(t.service.login(credentials, noDevice)).rejects.toThrow('Invalid credentials');
  });

  it('rejects an unverified user only after the password matched', async () => {
    t.users.findByEmail.mockResolvedValue({ ...verifiedUser, emailVerified: false });

    await expect(t.service.login(credentials, noDevice)).rejects.toThrow('Email not verified');
  });

  it('never opens a transaction', async () => {
    await t.service.login(credentials, noDevice);

    expect(t.transaction).not.toHaveBeenCalled();
  });

  it('leaves the cache untouched when the session write fails', async () => {
    t.sessions.create.mockRejectedValueOnce(new Error('db down'));

    await expect(t.service.login(credentials, noDevice)).rejects.toThrow('db down');
    expect(t.cache.set).not.toHaveBeenCalled();
  });

  it('stores Unknown for missing device labels', async () => {
    await t.service.login(credentials, noDevice);

    expect(t.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Unknown', clientType: 'Unknown' }),
    );
  });
});
