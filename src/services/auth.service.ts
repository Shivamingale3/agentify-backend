import crypto from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { HttpException } from '#exceptions/http.exception.js';
import type {
  AuthTokenPayload,
  EmailVerificationTask,
  LoginDto,
  RefreshTokenPayload,
  RegisterDto,
} from '#types/auth.types.js';
import { isUniqueViolation } from '#utils/errorGuards.js';
import * as bcrypt from 'bcrypt';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';
import type { Contract, Models } from '#prisma/contract.js';
import userService from '#services/user.service.js';
import { logger } from '#utils/logger.js';
import queueService from '#services/queue.service.js';
import { env } from '#providers/env.provider.js';
import { dbInstance, type Orm } from '#providers/db.provider.js';
import temporaryTaskService from '#services/temporaryTask.service.js';
import cacheService from '#services/cache.service.js';
import { emailVerificationTemplate } from '#utils/emailTemplates.js';
import { emailVerificationTaskSchema } from '#validationSchemas/auth/emailVerificationTask.schema.js';
import z from 'zod';
import jwtService from '#services/jwt.service.js';
import type { ExtraDeviceHeaders } from '#types/auth.types.js';
import sessionService from '#services/session.service.js';
import { ulid } from 'ulid';

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;
// bcrypt (cost 10, same as hashPassword) of a random string nobody knows; compared against when the email is unknown.
const DUMMY_PASSWORD_HASH = '$2b$10$9mnCjRy5..6kLPqeiNu7XuSgL7wfKjPpmzVBUybe3QuiNs0mjRowS';

class AuthService {
  public async login(
    userData: LoginDto,
    deviceHeaders: ExtraDeviceHeaders,
  ): Promise<{ authToken: string; refreshToken: string }> {
    try {
      const tokens = await dbInstance.transaction(async (tx) => {
        const user = await userService.getUserByEmail(userData.email, tx.orm);
        // Always run bcrypt and return one message, so unknown emails can't be told apart by reply or timing.
        const passwordMatches = await bcrypt.compare(
          userData.password,
          user?.password ?? DUMMY_PASSWORD_HASH,
        );
        if (!user || !passwordMatches) {
          throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }
        // Only revealed once the password is proven, so it can't be used to probe accounts.
        if (!user.emailVerified) {
          throw new HttpException(StatusCodes.UNAUTHORIZED, 'Email not verified');
        }
        return await this.getTokensPostAuthentication(user, deviceHeaders, tx.orm);
      });
      return tokens;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      logger.error('Login failed for user %s', userData.email, { error });
      throw error;
    }
  }

  public async register(userData: RegisterDto): Promise<void> {
    try {
      const hashedPassword = await this.hashPassword(userData.password);

      const createUserPayload: CreateInput<Contract, 'User'> = {
        firstName: null,
        lastName: null,
        countryCode: null,
        mobile: null,
        email: userData.email,
        emailVerified: false,
        password: hashedPassword,
      };

      if (userData.firstName) {
        createUserPayload.firstName = userData.firstName;
      }
      if (userData.lastName) {
        createUserPayload.lastName = userData.lastName;
      }
      if (userData.countryCode && userData.mobile) {
        createUserPayload.countryCode = userData.countryCode;
        createUserPayload.mobile = userData.mobile;
      }

      // User + verification task commit together; a failure in either rolls both back.
      const verification = await dbInstance.transaction(async (tx) => {
        const user = await userService.createUser(createUserPayload, tx.orm);
        return await this.createEmailVerificationTask(user, tx.orm);
      });
      // Cache and queue are not part of the DB transaction, so they run only after commit.
      await this.sendVerificationEmail(verification);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpException(StatusCodes.CONFLICT, 'User already exists');
      }
      logger.error('Registration failed for user %s', userData.email, { error });
      throw error;
    }
  }

  public async clearSession(userId: string, sessionId: string): Promise<void> {
    await cacheService.del(sessionId);
    await sessionService.deleteSessionByUserId(userId);
  }

  public async getTokensPostAuthentication(
    user: Models.public_User,
    deviceHeaders: ExtraDeviceHeaders,
    orm: Orm,
  ): Promise<{ authToken: string; refreshToken: string }> {
    const sessionId = ulid();
    const authToken = jwtService.generateToken<AuthTokenPayload>(
      { email: user.email, userId: user.id, sessionId },
      env.AUTH_EXPIRY,
    );

    const refreshToken = jwtService.generateToken<RefreshTokenPayload>(
      {
        userId: user.id,
        sessionId,
      },
      env.REFRESH_EXPIRY,
    );
    const sessionData = {
      clientType: deviceHeaders['x-client-type'] ?? 'Unknown',
      clientName: deviceHeaders['x-client-name'] ?? 'Unknown',
      token: refreshToken,
      id: sessionId,
      userId: user.id,
    };
    const session = await sessionService.createSession(sessionData, orm);
    await cacheService.set(sessionId, session);
    return { authToken, refreshToken };
  }

  private async sendVerificationEmail(payload: EmailVerificationTask): Promise<void> {
    await cacheService.set(payload.token, payload, EMAIL_VERIFICATION_TTL_MS);
    const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${payload.token}`;

    await queueService.enqueueJob({
      type: 'email',
      data: {
        to: payload.email,
        subject: 'Email Verification',
        text: 'Please verify your email',
        html: emailVerificationTemplate(payload.email, verificationLink),
      },
    });
    logger.info('Verification email queued for %s', payload.email);
  }

  private async createEmailVerificationTask(
    user: Models.public_User,
    orm: Orm,
  ): Promise<EmailVerificationTask> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Temporal.Now.instant().add({ milliseconds: EMAIL_VERIFICATION_TTL_MS });
    const payload: EmailVerificationTask = {
      token,
      email: user.email,
      userId: user.id,
      validTill: expiresAt.toString(),
    };
    const task: CreateInput<Contract, 'TemporaryTasks'> = {
      token,
      taskData: payload,
      taskType: 'EMAIL_VERIFICATION',
      expiresAt,
    };
    await temporaryTaskService.createTask({ data: task }, orm);
    return payload;
  }

  public async verifyEmail(token: string): Promise<void> {
    try {
      let payload: EmailVerificationTask | null = null;
      payload = await cacheService.get<EmailVerificationTask>(token, emailVerificationTaskSchema);
      if (!payload) {
        const task = await temporaryTaskService.getTaskByToken(token);
        if (!task) {
          throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid token');
        }
        payload = z.parse(emailVerificationTaskSchema, task.taskData);
      }
      if (payload.token !== token) {
        throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid token');
      }
      if (new Date(payload.validTill) < new Date()) {
        // The token can never succeed now, so drop it instead of leaving it for the cleanup job.
        await temporaryTaskService.deleteTaskByToken(token);
        await cacheService.del(token);
        throw new HttpException(StatusCodes.UNAUTHORIZED, 'Token expired');
      }

      const { userId } = payload;
      await dbInstance.transaction(async (tx) => {
        // Deleting first makes the token single-use: a concurrent request finds nothing and fails.
        const task = await temporaryTaskService.deleteTaskByToken(token, tx.orm);
        if (!task) {
          throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid token');
        }
        const user = await userService.updateUser(
          { userId, userData: { emailVerified: true } },
          tx.orm,
        );
        if (!user) {
          throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid token');
        }
      });
      await cacheService.del(token);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      logger.error('Email verification failed', { error });
      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }
}

const authService = new AuthService();
export default authService;
