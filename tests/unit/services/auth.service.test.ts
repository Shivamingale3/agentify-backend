import { StatusCodes } from 'http-status-codes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '#exceptions/http.exception.js';
import type { Models } from '#prisma/contract.js';
import { dbInstance } from '#providers/db.provider.js';
import { env } from '#providers/env.provider.js';
import authService from '#services/auth.service.js';
import cacheService from '#services/cache.service.js';
import queueService from '#services/queue.service.js';
import temporaryTaskService from '#services/temporaryTask.service.js';
import userService from '#services/user.service.js';
import { logger } from '#utils/logger.js';
import type { EmailVerificationTask } from '#types/auth.types.js';

// Unit test: every I/O boundary is mocked, so this only exercises AuthService's own logic.
vi.mock('#providers/db.provider.js', () => ({
  db: {},
  // Run the callback immediately with a fake tx, like a transaction that always commits.
  dbInstance: { transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ orm: {} })) },
}));
vi.mock('#services/user.service.js', () => ({
  default: { createUser: vi.fn(), updateUser: vi.fn() },
}));
vi.mock('#services/temporaryTask.service.js', () => ({
  default: { createTask: vi.fn(), getTaskByToken: vi.fn(), deleteTaskByToken: vi.fn() },
}));
vi.mock('#services/cache.service.js', () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('#services/queue.service.js', () => ({ default: { enqueueJob: vi.fn() } }));

const user = { id: 'user_1', email: 'a@example.com' } as Models.public_User;
const task = { token: 'tok' } as Models.public_TemporaryTasks;

function payload(overrides: Partial<EmailVerificationTask> = {}): EmailVerificationTask {
  return {
    token: 'tok',
    email: user.email,
    userId: user.id,
    validTill: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

async function expectHttpError(promise: Promise<unknown>, status: number): Promise<void> {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect(error).toMatchObject({ statusCode: status });
}

describe('AuthService.register', () => {
  beforeEach(() => {
    vi.mocked(userService.createUser).mockResolvedValue(user);
  });

  it('creates the user and task, then caches the token and enqueues the email', async () => {
    await authService.register({ email: user.email, password: 'Passw0rd!' });

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, emailVerified: false }),
      expect.anything(),
    );
    const [createdUser] = vi.mocked(userService.createUser).mock.calls[0] ?? [];
    expect(createdUser?.password).not.toBe('Passw0rd!'); // stored hashed
    expect(temporaryTaskService.createTask).toHaveBeenCalledOnce();
    expect(cacheService.set).toHaveBeenCalledOnce();
    expect(queueService.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email', data: expect.objectContaining({ to: user.email }) }),
    );
  });

  it('maps a unique violation to 409 and sends nothing', async () => {
    const duplicate = Object.assign(new Error('duplicate'), {
      kind: 'sql_query',
      sqlState: '23505',
    });
    vi.mocked(userService.createUser).mockRejectedValue(duplicate);

    await expectHttpError(
      authService.register({ email: user.email, password: 'Passw0rd!' }),
      StatusCodes.CONFLICT,
    );
    expect(queueService.enqueueJob).not.toHaveBeenCalled();
  });

  it('copies optional profile fields, and the phone only when both parts are present', async () => {
    await authService.register({
      email: user.email,
      password: 'Passw0rd!',
      firstName: 'Ada',
      lastName: 'Lovelace',
      countryCode: '+44',
      mobile: '7000000000',
    });
    await authService.register({ email: user.email, password: 'Passw0rd!', mobile: '7000000000' });

    const calls = vi.mocked(userService.createUser).mock.calls;
    const full = calls[0]?.[0];
    const partial = calls[1]?.[0];
    expect(full).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      countryCode: '+44',
      mobile: '7000000000',
    });
    expect(partial).toMatchObject({
      firstName: null,
      lastName: null,
      countryCode: null,
      mobile: null,
    });
  });

  it('stores one random token in the task, the cache and the emailed link', async () => {
    await authService.register({ email: user.email, password: 'Passw0rd!' });

    const [taskArg] = vi.mocked(temporaryTaskService.createTask).mock.calls[0] ?? [];
    const token = taskArg?.data.token ?? '';
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(taskArg?.data).toMatchObject({
      taskType: 'EMAIL_VERIFICATION',
      taskData: { token, email: user.email, userId: user.id },
    });
    expect(cacheService.set).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ token, userId: user.id }),
      60 * 60 * 1000,
    );
    const [job] = vi.mocked(queueService.enqueueJob).mock.calls[0] ?? [];
    expect(job?.type === 'email' ? job.data.html : '').toContain(
      `${env.FRONTEND_URL}/verify-email?token=${token}`,
    );
  });

  it('rethrows non-unique errors unchanged and sends nothing', async () => {
    const error = new Error('db down');
    vi.mocked(temporaryTaskService.createTask).mockRejectedValue(error);

    await expect(authService.register({ email: user.email, password: 'Passw0rd!' })).rejects.toBe(
      error,
    );
    expect(cacheService.set).not.toHaveBeenCalled();
    expect(queueService.enqueueJob).not.toHaveBeenCalled();
  });

  it('runs the user and task writes in one transaction', async () => {
    await authService.register({ email: user.email, password: 'Passw0rd!' });

    expect(dbInstance.transaction).toHaveBeenCalledOnce();
  });
});

describe('AuthService.verifyEmail', () => {
  it('verifies the user, consumes the task and clears the cache', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(payload());
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockResolvedValue(task);
    vi.mocked(userService.updateUser).mockResolvedValue({ ...user, emailVerified: true });

    await authService.verifyEmail('tok');

    expect(userService.updateUser).toHaveBeenCalledWith(
      { userId: user.id, userData: { emailVerified: true } },
      expect.anything(),
    );
    expect(cacheService.del).toHaveBeenCalledWith('tok');
  });

  it('falls back to the DB task on a cache miss', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(temporaryTaskService.getTaskByToken).mockResolvedValue({
      ...task,
      taskData: payload(),
    });
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockResolvedValue(task);
    vi.mocked(userService.updateUser).mockResolvedValue(user);

    await authService.verifyEmail('tok');

    expect(userService.updateUser).toHaveBeenCalledOnce();
  });

  it('rejects an unknown token', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(temporaryTaskService.getTaskByToken).mockResolvedValue(null);

    await expectHttpError(authService.verifyEmail('nope'), StatusCodes.UNAUTHORIZED);
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(
      payload({ validTill: new Date(Date.now() - 1).toISOString() }),
    );

    await expectHttpError(authService.verifyEmail('tok'), StatusCodes.UNAUTHORIZED);
    // Regression: the dead token is removed immediately; the user is never touched.
    expect(temporaryTaskService.deleteTaskByToken).toHaveBeenCalledWith('tok');
    expect(cacheService.del).toHaveBeenCalledWith('tok');
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a token that was already used', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(payload());
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockResolvedValue(null);

    await expectHttpError(authService.verifyEmail('tok'), StatusCodes.UNAUTHORIZED);
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a cached payload issued for a different token', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(payload({ token: 'other' }));

    await expectHttpError(authService.verifyEmail('tok'), StatusCodes.UNAUTHORIZED);
    expect(temporaryTaskService.deleteTaskByToken).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists and keeps the cache entry', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(payload());
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockResolvedValue(task);
    vi.mocked(userService.updateUser).mockResolvedValue(null);

    await expectHttpError(authService.verifyEmail('tok'), StatusCodes.UNAUTHORIZED);
    expect(cacheService.del).not.toHaveBeenCalled();
  });

  it('rejects a DB task whose data does not match the schema', async () => {
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(temporaryTaskService.getTaskByToken).mockResolvedValue({
      ...task,
      taskData: { token: 'tok' },
    });

    await expect(authService.verifyEmail('tok')).rejects.toThrow();
    expect(temporaryTaskService.deleteTaskByToken).not.toHaveBeenCalled();
  });

  it('rethrows unexpected errors unchanged', async () => {
    const error = new Error('db down');
    vi.mocked(cacheService.get).mockResolvedValue(payload());
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockRejectedValue(error);

    await expect(authService.verifyEmail('tok')).rejects.toBe(error);
    expect(cacheService.del).not.toHaveBeenCalled();
  });

  // Regression: the raw token used to be written to the error log.
  it('never logs the token when verification fails unexpectedly', async () => {
    const logError = vi.spyOn(logger, 'error');
    vi.mocked(cacheService.get).mockResolvedValue(payload());
    vi.mocked(temporaryTaskService.deleteTaskByToken).mockRejectedValue(new Error('db down'));

    await expect(authService.verifyEmail('tok')).rejects.toThrow('db down');

    expect(logError).toHaveBeenCalled();
    expect(JSON.stringify(logError.mock.calls)).not.toContain('tok');
  });
});
