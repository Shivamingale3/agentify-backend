import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Contract, Models } from '@/database/prisma/contract.js';
import { Injectable } from '@nestjs/common';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

// Each method takes an optional `orm`: pass `tx.orm` to run it inside a transaction.
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateInput<Contract, 'User'>,
    orm: Orm = this.db.orm,
  ): Promise<Models.public_User> {
    return await orm.public.User.create(data);
  }

  async findByEmail(email: string, orm: Orm = this.db.orm): Promise<Models.public_User | null> {
    return await orm.public.User.where({ email }).first();
  }

  async update(
    id: string,
    data: Partial<Models.public_User>,
    orm: Orm = this.db.orm,
  ): Promise<Models.public_User | null> {
    // updateAll() on the primary key is one `UPDATE … RETURNING`; update() would first run a
    // `SELECT id` and then update by id (2 round trips).
    return await orm.public.User.where({ id }).updateAll(data).first();
  }
}
