import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Models } from '#prisma/contract.js';
import type { Orm } from '#providers/db.provider.js';
import temporaryTaskService from '#services/temporaryTask.service.js';

// A fake Orm exposing only the query-builder calls TemporaryTaskService uses.
function fakeOrm() {
  const query = { delete: vi.fn() };
  const TemporaryTasks = { create: vi.fn(), first: vi.fn(), where: vi.fn(() => query) };
  return { orm: { public: { TemporaryTasks } }, TemporaryTasks, query };
}

const fake = vi.hoisted(() => ({ db: {} as Record<string, unknown> }));
vi.mock('#providers/db.provider.js', () => ({ db: fake.db }));

const task = { token: 'tok' } as Models.public_TemporaryTasks;
let defaultOrm: ReturnType<typeof fakeOrm>;

beforeEach(() => {
  defaultOrm = fakeOrm();
  Object.assign(fake.db, defaultOrm.orm);
});

describe('TemporaryTaskService', () => {
  it('createTask creates the row through the default orm', async () => {
    defaultOrm.TemporaryTasks.create.mockResolvedValue(task);
    const data = { token: 'tok', taskData: { a: 1 }, taskType: 'EMAIL_VERIFICATION' } as const;

    await expect(temporaryTaskService.createTask({ data })).resolves.toBe(task);
    expect(defaultOrm.TemporaryTasks.create).toHaveBeenCalledWith(data);
  });

  it('createTask uses the passed transaction orm', async () => {
    const tx = fakeOrm();
    tx.TemporaryTasks.create.mockResolvedValue(task);

    await temporaryTaskService.createTask(
      { data: { token: 'tok', taskData: {}, taskType: 'EMAIL_VERIFICATION' } },
      tx.orm as unknown as Orm,
    );

    expect(tx.TemporaryTasks.create).toHaveBeenCalledOnce();
    expect(defaultOrm.TemporaryTasks.create).not.toHaveBeenCalled();
  });

  it('getTaskByToken finds the first task with that token', async () => {
    defaultOrm.TemporaryTasks.first.mockResolvedValue(task);

    await expect(temporaryTaskService.getTaskByToken('tok')).resolves.toBe(task);
    expect(defaultOrm.TemporaryTasks.first).toHaveBeenCalledWith({ token: 'tok' });

    defaultOrm.TemporaryTasks.first.mockResolvedValue(null);
    await expect(temporaryTaskService.getTaskByToken('nope')).resolves.toBeNull();
  });

  it('deleteTaskByToken deletes scoped to the token and returns the deleted row', async () => {
    const tx = fakeOrm();
    tx.query.delete.mockResolvedValue(task);

    await expect(
      temporaryTaskService.deleteTaskByToken('tok', tx.orm as unknown as Orm),
    ).resolves.toBe(task);
    expect(tx.TemporaryTasks.where).toHaveBeenCalledWith({ token: 'tok' });
    expect(defaultOrm.TemporaryTasks.where).not.toHaveBeenCalled();
  });

  it('deleteTaskByToken returns null when nothing matched', async () => {
    defaultOrm.query.delete.mockResolvedValue(null);

    await expect(temporaryTaskService.deleteTaskByToken('used')).resolves.toBeNull();
  });
});
