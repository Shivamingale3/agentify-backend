import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Contract, Models } from '@/database/prisma/contract.js';
import { Injectable } from '@nestjs/common';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

type Chore = Models.public_Chore;

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
    return await orm.public.Chore.where({ token }).deleteAll().first();
  }

  async deleteExpired(
    now: Temporal.Instant = Temporal.Now.instant(),
    orm: Orm = this.db.orm,
  ): Promise<number> {
    return await orm.public.Chore.where((task) => task.expiresAt.lt(now)).deleteAndCount();
  }
}
