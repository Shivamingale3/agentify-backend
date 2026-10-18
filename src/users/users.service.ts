import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Contract, Models } from '@/database/prisma/contract.js';
import { Injectable } from '@nestjs/common';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

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
    return await orm.public.User.where({ id }).updateAll(data).first();
  }
}
