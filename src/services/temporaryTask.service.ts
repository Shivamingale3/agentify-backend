import type { Contract, Models } from '#prisma/contract.js';
import { db } from '#providers/db.provider.js';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';

class TemporaryTaskService {
  private temporaryTaskModel: typeof db.public.TemporaryTasks;

  constructor(model: typeof db.public.TemporaryTasks = db.public.TemporaryTasks) {
    this.temporaryTaskModel = model;
  }

  public async createTask({
    data,
  }: {
    data: CreateInput<Contract, 'TemporaryTasks'>;
  }): Promise<Models.public_TemporaryTasks | null> {
    return await this.temporaryTaskModel.create(data);
  }

  public async getTaskByToken(token: string): Promise<Models.public_TemporaryTasks | null> {
    return await this.temporaryTaskModel.first({ token });
  }

  public async deleteTaskByToken(token: string): Promise<void> {
    await this.temporaryTaskModel.where({ token }).delete();
  }
}
const temporaryTaskService = new TemporaryTaskService(db.public.TemporaryTasks);
export default temporaryTaskService;
