import type { Contract, Models } from '#prisma/contract.js';
import { db, type Orm } from '#providers/db.provider.js';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

// `orm` is injected for tests; each method also accepts `tx.orm` to run inside a transaction.
class UserService {
  constructor(private readonly orm: Orm = db) {}

  public async createUser(
    userData: CreateInput<Contract, 'User'>,
    orm: Orm = this.orm,
  ): Promise<Models.public_User> {
    return await orm.public.User.create(userData);
  }

  public async updateUser(
    {
      userId,
      userData,
    }: {
      userId: string;
      userData: Partial<Models.public_User>;
    },
    orm: Orm = this.orm,
  ): Promise<Models.public_User | null> {
    // updateAll() on the primary key is one `UPDATE … RETURNING` statement; update() would first run
    // a `SELECT id` and then update by id (2 round trips).
    return await orm.public.User.where({ id: userId }).updateAll(userData).first();
  }

  public async getUserById(
    userId: string,
    orm: Orm = this.orm,
  ): Promise<Models.public_User | null> {
    return await orm.public.User.where({ id: userId }).first();
  }

  public async getUserByEmail(
    email: string,
    orm: Orm = this.orm,
  ): Promise<Models.public_User | null> {
    return await orm.public.User.where({ email }).first();
  }
}

const userService = new UserService(db);
export default userService;
