import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Contract, Models } from '@/database/prisma/contract.js';
import { Injectable } from '@nestjs/common';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

type Chore = Models.public_Chore;

// Each method takes an optional `orm`: pass `tx.orm` to run it inside a transaction.
@Injectable()
export class ChoresService {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateInput<Contract, 'Chore'>, orm: Orm = this.db.orm): Promise<Chore> {
    return await orm.public.Chore.create(data);
  }

  async findByToken(token: string, orm: Orm = this.db.orm): Promise<Chore | null> {
    return await orm.public.Chore.first({ token });
  }

  async deleteByToken(token: string, orm: Orm = this.db.orm): Promise<Chore | null> {
    // deleteAll() on a unique key is one `DELETE … RETURNING` statement; delete() would first run a
    // `SELECT id` and then delete by id (2 round trips). Still single-use under concurrency: a
    // second caller blocks on the row lock, then finds it gone and gets null.
    return await orm.public.Chore.where({ token }).deleteAll().first();
  }

  /** Deletes every chore whose `expiresAt` is before `now`. Returns how many were removed. */
  async deleteExpired(
    now: Temporal.Instant = Temporal.Now.instant(),
    orm: Orm = this.db.orm,
  ): Promise<number> {
    // deleteAndCount() returns only the affected-row count; deleteAll().toArray() would ship every
    // deleted row (JSON payload included) to Node just to read .length: 2.8 s vs 0.12 s for 100k rows.
    return await orm.public.Chore.where((task) => task.expiresAt.lt(now)).deleteAndCount();
  }
}
