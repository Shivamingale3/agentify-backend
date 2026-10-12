import type { Contract, Models } from '#prisma/contract.js';
import { db } from '#providers/db.provider.js';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

class UserService {
  private userModel: typeof db.public.User;

  constructor(userModel: typeof db.public.User = db.public.User) {
    this.userModel = userModel;
  }

  public async createUser(
    userData: CreateInput<Contract, 'User'>,
  ): Promise<Models.public_User | null> {
    return await this.userModel.create(userData);
  }

  public async updateUser({
    userId,
    userData,
  }: {
    userId: string;
    userData: Partial<Models.public_User>;
  }): Promise<Models.public_User | null> {
    return await this.userModel.where({ id: userId }).update(userData);
  }

  public async getUserById(userId: string): Promise<Models.public_User | null> {
    return await this.userModel.where({ id: userId }).first();
  }
}

const userService = new UserService(db.public.User);
export default userService;
