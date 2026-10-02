import { StatusCodes } from 'http-status-codes';
import { HttpException } from '#exceptions/http.exception.js';
import type { RegisterDto } from '#types/auth.types.js';
import { db } from '#providers/db.provider.js';
import { isUniqueViolation } from '#utils/errorGuards.js';

class AuthService {
  public async register(userData: RegisterDto): Promise<void> {
    try {
      await db.public.User.create(userData);
    } catch (error) {
      // Prisma 8 reports unique violations as SqlQueryError with SQLSTATE 23505
      if (isUniqueViolation(error)) {
        throw new HttpException(StatusCodes.CONFLICT, 'User already exists');
      }
      // Anything else (connection down, bad input, …) is classified by the error middleware
      throw error;
    }
  }
}

const authService = new AuthService();
export default authService;
