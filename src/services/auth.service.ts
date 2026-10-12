import crypto from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { HttpException } from '#exceptions/http.exception.js';
import type { EmailVerificationTask, RegisterDto } from '#types/auth.types.js';
import { isUniqueViolation } from '#utils/errorGuards.js';
import * as bcrypt from 'bcrypt';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';
import { type Contract, type Models } from '#prisma/contract.js';
import userService from '#services/user.service.js';
import { logger } from '#utils/logger.js';
import queueService from '#services/queue.service.js';
import { env } from '#providers/env.provider.js';
import temporaryTaskService from '#services/temporaryTask.service.js';
import cacheService from '#services/cache.service.js';
import { emailVerificationTemplate } from '#utils/emailTemplates.js';
import { emailVerificationTaskSchema } from '#validationSchemas/auth/emailVerificationTask.schema.js';
import z from 'zod';
class AuthService {
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

      const user = await userService.createUser(createUserPayload);
      if (!user) {
        throw new HttpException(StatusCodes.INTERNAL_SERVER_ERROR, 'User creation failed');
      }
      await this.sendVerificationEmail(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpException(StatusCodes.CONFLICT, 'User already exists');
      }
      logger.error('Registration failed for user %s', userData.email, { error });
      throw error;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private async comparePasswords(plainPassword: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hash);
  }

  private async sendVerificationEmail(user: Models.public_User): Promise<void> {
    const verificationLink = await this.createEmailVerificationLink(user);

    await queueService.enqueueJob({
      type: 'email',
      data: {
        to: user.email,
        subject: 'Email Verification',
        text: 'Please verify your email',
        html: emailVerificationTemplate(user.email, verificationLink),
      },
    });
    logger.info('Verification email queued for %s', user.email);
  }

  private async createEmailVerificationLink(user: Models.public_User): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const validity = 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + validity);
    const payload: EmailVerificationTask = {
      token,
      email: user.email,
      userId: user.id,
      validTill: expiresAt.toISOString(),
    };
    const task: CreateInput<Contract, 'TemporaryTasks'> = {
      token,
      taskData: payload,
      taskType: 'EMAIL_VERIFICATION',
    };
    await temporaryTaskService.createTask({ data: task });
    await cacheService.set(token, payload, validity);
    return `${env.FRONTEND_URL}/verify-email?token=${token}`;
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
        throw new HttpException(StatusCodes.UNAUTHORIZED, 'Token expired');
      }

      const user = await userService.getUserById(payload.userId);

      if (!user) {
        throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid token');
      }

      await userService.updateUser({ userId: user.id, userData: { emailVerified: true } });

      await temporaryTaskService.deleteTaskByToken(payload.token);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      logger.error('Email verification failed for token %s', token, { error });
      throw error;
    }
  }
}

const authService = new AuthService();
export default authService;
