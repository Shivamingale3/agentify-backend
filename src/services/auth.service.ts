import { StatusCodes } from 'http-status-codes';
import { HttpException } from '../exceptions/http.exception';
import type { RegisterDto } from '../types/auth.types';
import { isStructuredError } from '@prisma/orm-postgres/utils/structured-error';
import { db } from '../providers/db.provider';

class AuthService {
  public async register(userData: RegisterDto): Promise<void> {
    try {
      await db.public.User.create(userData);
    } catch (error) {
      if (isStructuredError(error)) {
        // Prisma 8 matching code for unique constraint violation
        if (error.code === 'ORM.UNIQUE_CONSTRAINT_VIOLATION') {
          throw new HttpException(StatusCodes.CONFLICT, 'User already exists');
        }
      } else {
        throw new HttpException(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to register user');
      }
    }
  }
}

const authService = new AuthService();
export default authService;
