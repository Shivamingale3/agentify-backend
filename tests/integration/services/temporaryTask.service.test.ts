import { afterAll, describe, expect, it } from 'vitest';
import { db, dbInstance } from '#providers/db.provider.js';
import temporaryTaskService from '#services/temporaryTask.service.js';
import { isUniqueViolation } from '#utils/errorGuards.js';
import { queryLogOrm } from '../helpers/queryLog.js';

const log = queryLogOrm();
afterAll(() => log.close());

const inOneHour = (): Temporal.Instant => Temporal.Now.instant().add({ hours: 1 });

const taskFor = (token: string, expiresAt: Temporal.Instant = inOneHour()) => ({
  data: {
    token,
    expiresAt,
    taskType: 'EMAIL_VERIFICATION' as const,
    taskData: {
      token,
      email: 'jane@example.com',
      userId: 'u1',
      validTill: '2099-01-01T00:00:00.000Z',
    },
  },
});

describe('temporaryTaskService (real Postgres)', () => {
  it('creates a task and finds it by token', async () => {
    const created = await temporaryTaskService.createTask(taskFor('tok-1'));

    expect(created).toMatchObject({ token: 'tok-1', taskType: 'EMAIL_VERIFICATION' });
    expect(await temporaryTaskService.getTaskByToken('tok-1')).toMatchObject({
      id: created.id,
      taskData: { email: 'jane@example.com' },
    });
  });

  it('returns null for an unknown token', async () => {
    expect(await temporaryTaskService.getTaskByToken('missing')).toBeNull();
  });

  // Regression: where().delete() ran SELECT id + DELETE (2 round trips).
  it('deletes by token in a single DELETE statement', async () => {
    await temporaryTaskService.createTask(taskFor('tok-1'));
    log.sql.length = 0;

    expect(await temporaryTaskService.deleteTaskByToken('tok-1', log.orm)).toMatchObject({
      token: 'tok-1',
    });
    expect(log.sql).toHaveLength(1);
    expect(log.sql[0]).toMatch(/^DELETE FROM .* WHERE "temporary_tasks"\."token" = \$1/);
  });

  it('deletes by token, returning the row once and null afterwards', async () => {
    await temporaryTaskService.createTask(taskFor('tok-1'));

    expect(await temporaryTaskService.deleteTaskByToken('tok-1')).toMatchObject({ token: 'tok-1' });
    expect(await temporaryTaskService.deleteTaskByToken('tok-1')).toBeNull();
    expect(await temporaryTaskService.getTaskByToken('tok-1')).toBeNull();
  });

  it('only deletes the task matching the token', async () => {
    await temporaryTaskService.createTask(taskFor('tok-1'));
    await temporaryTaskService.createTask(taskFor('tok-2'));

    await temporaryTaskService.deleteTaskByToken('tok-1');

    const remaining = await db.public.TemporaryTasks.all().toArray();
    expect(remaining.map((t) => t.token)).toEqual(['tok-2']);
  });

  it('rejects a duplicate token with a unique violation', async () => {
    await temporaryTaskService.createTask(taskFor('tok-1'));

    const error: unknown = await temporaryTaskService
      .createTask(taskFor('tok-1'))
      .catch((e: unknown) => e);

    expect(isUniqueViolation(error)).toBe(true);
  });

  it('rolls back a delete made with tx.orm when the transaction throws', async () => {
    await temporaryTaskService.createTask(taskFor('tok-1'));

    await expect(
      dbInstance.transaction(async (tx) => {
        await temporaryTaskService.deleteTaskByToken('tok-1', tx.orm);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await temporaryTaskService.getTaskByToken('tok-1')).not.toBeNull();
  });

  // Regression: unused expired tasks used to stay in the table forever.
  // Regression: deleteExpired ran `DELETE … RETURNING *` and shipped every deleted row to Node just
  // to count them (2.8 s vs 0.12 s for 100k rows). It must return only the count.
  it('deleteExpired never returns the deleted rows, only the count', async () => {
    const past = Temporal.Now.instant().subtract({ minutes: 1 });
    await temporaryTaskService.createTask(taskFor('old-1', past));
    await temporaryTaskService.createTask(taskFor('old-2', past));
    log.sql.length = 0;

    expect(await temporaryTaskService.deleteExpired(Temporal.Now.instant(), log.orm)).toBe(2);
    expect(log.sql.filter((sql) => sql.includes('RETURNING'))).toEqual([]);
  });

  it('deleteExpired removes only tasks whose expiresAt has passed', async () => {
    const past = Temporal.Now.instant().subtract({ minutes: 1 });
    await temporaryTaskService.createTask(taskFor('expired-1', past));
    await temporaryTaskService.createTask(taskFor('expired-2', past));
    await temporaryTaskService.createTask(taskFor('live'));

    expect(await temporaryTaskService.deleteExpired()).toBe(2);

    const remaining = await db.public.TemporaryTasks.all().toArray();
    expect(remaining.map((task) => task.token)).toEqual(['live']);
  });

  it('deleteExpired returns 0 when nothing has expired', async () => {
    await temporaryTaskService.createTask(taskFor('live'));
    expect(await temporaryTaskService.deleteExpired()).toBe(0);
  });
});
