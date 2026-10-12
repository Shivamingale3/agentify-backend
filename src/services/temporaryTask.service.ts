import type { Contract, Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

// `orm` is injected for tests; each method also accepts `tx.orm` to run inside a transaction.
class TemporaryTaskService {
  constructor(private readonly orm: Orm = db) {}

  public async createTask(
    { data }: { data: CreateInput<Contract, 'TemporaryTasks'> },
    orm: Orm = this.orm,
  ): Promise<Models.public_TemporaryTasks> {
    return await orm.public.TemporaryTasks.create(data);
  }

  public async getTaskByToken(
    token: string,
    orm: Orm = this.orm,
  ): Promise<Models.public_TemporaryTasks | null> {
    return await orm.public.TemporaryTasks.first({ token });
  }

  public async deleteTaskByToken(
    token: string,
    orm: Orm = this.orm,
  ): Promise<Models.public_TemporaryTasks | null> {
    return await orm.public.TemporaryTasks.where({ token }).delete();
  }

  /** Deletes every task whose `expiresAt` is before `now`. Returns how many were removed. */
  public async deleteExpired(
    now: Temporal.Instant = Temporal.Now.instant(),
    orm: Orm = this.orm,
  ): Promise<number> {
    const deleted = await orm.public.TemporaryTasks.where((task) => task.expiresAt.lt(now))
      .deleteAll()
      .toArray();
    return deleted.length;
  }
}

const temporaryTaskService = new TemporaryTaskService(db);
export default temporaryTaskService;
