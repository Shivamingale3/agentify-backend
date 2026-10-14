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
    // deleteAll() on a unique key is one `DELETE … RETURNING` statement; delete() would first run a
    // `SELECT id` and then delete by id (2 round trips). Still single-use under concurrency: a
    // second caller blocks on the row lock, then finds it gone and gets null.
    return await orm.public.TemporaryTasks.where({ token }).deleteAll().first();
  }

  /** Deletes every task whose `expiresAt` is before `now`. Returns how many were removed. */
  public async deleteExpired(
    now: Temporal.Instant = Temporal.Now.instant(),
    orm: Orm = this.orm,
  ): Promise<number> {
    // deleteAndCount() returns only the affected-row count. deleteAll().toArray() ran
    // `DELETE … RETURNING *` and shipped every deleted row (JSON payload included) to Node just to
    // read .length: 2.8 s vs 0.12 s for 100k expired rows (see docs/Experience.md).
    return await orm.public.TemporaryTasks.where((task) => task.expiresAt.lt(now)).deleteAndCount();
  }
}

const temporaryTaskService = new TemporaryTaskService(db);
export default temporaryTaskService;
