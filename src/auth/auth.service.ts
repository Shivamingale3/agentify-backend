import type { DeviceInfo } from '@/auth/decorators/device-headers.decorator.js';
import type { LoginDto } from '@/auth/dto/login.dto.js';
import type { RegisterDto } from '@/auth/dto/register.dto.js';
import {
  emailVerificationTaskSchema,
  type EmailVerificationTask,
} from '@/auth/email-verification-task.schema.js';
import { SessionService, sessionCacheKey, type Session } from '@/auth/session.service.js';
import type { AuthTokenPayload, RefreshTokenPayload } from '@/auth/token-payload.schema.js';
import { CacheService } from '@/cache/cache.service.js';
import { ChoresService } from '@/chores/chores.service.js';
import { isUniqueViolation } from '@/common/utils/error-guards.js';
import type { Env } from '@/config/env/env.schema.js';
import { DatabaseService, type Orm } from '@/database/database.service.js';
import type { Contract, Models } from '@/database/prisma/contract.js';
import { emailVerificationTemplate } from '@/mail/templates/email-verification.template.js';
import { QueueService } from '@/queue/queue.service.js';
import { UsersService } from '@/users/users.service.js';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CreateInput } from '@prisma/orm-postgres/orm-client';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;
const BCRYPT_COST = 10;
// bcrypt (cost 10) of a random string nobody knows; compared against when the email is unknown.
const DUMMY_PASSWORD_HASH = '$2b$10$9mnCjRy5..6kLPqeiNu7XuSgL7wfKjPpmzVBUybe3QuiNs0mjRowS';

export interface AuthTokens {
  authToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly chores: ChoresService,
    private readonly cache: CacheService,
    private readonly queue: QueueService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    // Intentional: the frontend pre-fills countryCode (India), so a countryCode with no mobile
    // isn't a real choice by the user. Store the phone only when both parts are sent; otherwise
    // drop both silently (no 400), so a default value never ends up as stored data.
    const phone =
      dto.countryCode && dto.mobile
        ? { countryCode: dto.countryCode, mobile: dto.mobile }
        : { countryCode: null, mobile: null };
    const data: CreateInput<Contract, 'User'> = {
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      ...phone,
      email: dto.email,
      emailVerified: false,
      password: await hash(dto.password, BCRYPT_COST),
    };

    let verification: EmailVerificationTask;
    try {
      // User + verification chore commit together; a failure in either rolls both back.
      verification = await this.db.client.transaction(async (tx) => {
        const user = await this.users.create(data, tx.orm);
        return await this.createVerificationChore(user, tx.orm);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('User already exists');
      throw error;
    }
    // Cache and queue are not part of the DB transaction, so they run only after commit.
    await this.sendVerificationEmail(verification);
  }

  async login(dto: LoginDto, device: DeviceInfo): Promise<AuthTokens> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await compare(dto.password, user?.password ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) throw new UnauthorizedException('Invalid credentials');
    if (!user.emailVerified) throw new UnauthorizedException('Email not verified');
    const { tokens, session } = await this.issueTokens(user, device);
    const ttlMs = this.config.get('REFRESH_EXPIRY', { infer: true }) * 1000;
    await this.cache.set(sessionCacheKey(user.id), session, ttlMs);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.cache.del(sessionCacheKey(userId));
    await this.sessions.deleteByUserId(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = await this.findVerification(token);
    if (
      Temporal.Instant.compare(Temporal.Instant.from(payload.validTill), Temporal.Now.instant()) < 0
    ) {
      // The token can never succeed now, so drop it instead of leaving it for the cleanup job.
      await this.chores.deleteByToken(token);
      await this.cache.del(token);
      throw new UnauthorizedException('Token expired');
    }

    await this.db.client.transaction(async (tx) => {
      // Deleting first makes the token single-use: a concurrent request finds nothing and fails.
      const chore = await this.chores.deleteByToken(token, tx.orm);
      if (!chore) throw new UnauthorizedException('Invalid token');
      const user = await this.users.update(payload.userId, { emailVerified: true }, tx.orm);
      if (!user) throw new UnauthorizedException('Invalid token');
    });
    await this.cache.del(token);
  }

  /** The cache is the fast path; the chore row is the source of truth when the cache misses. */
  private async findVerification(token: string): Promise<EmailVerificationTask> {
    const cached = await this.cache.get(token, emailVerificationTaskSchema);
    if (cached) return cached;
    const chore = await this.chores.findByToken(token);
    if (!chore) throw new UnauthorizedException('Invalid token');
    return emailVerificationTaskSchema.parse(chore.taskData);
  }

  private async issueTokens(
    user: Models.public_User,
    device: DeviceInfo,
  ): Promise<{ tokens: AuthTokens; session: Session }> {
    const sessionId = ulid();
    const authPayload: AuthTokenPayload = { userId: user.id, email: user.email, sessionId };
    const refreshPayload: RefreshTokenPayload = { userId: user.id, sessionId };
    const [authToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(authPayload, {
        expiresIn: this.config.get('AUTH_EXPIRY', { infer: true }),
      }),
      this.jwt.signAsync(refreshPayload, {
        expiresIn: this.config.get('REFRESH_EXPIRY', { infer: true }),
      }),
    ]);
    const session = await this.sessions.create({
      id: sessionId,
      userId: user.id,
      token: refreshToken,
      clientName: device.clientName ?? 'Unknown',
      clientType: device.clientType ?? 'Unknown',
    });
    return { tokens: { authToken, refreshToken }, session };
  }

  private async createVerificationChore(
    user: Models.public_User,
    orm: Orm,
  ): Promise<EmailVerificationTask> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Temporal.Now.instant().add({ milliseconds: EMAIL_VERIFICATION_TTL_MS });
    const payload: EmailVerificationTask = {
      token,
      email: user.email,
      userId: user.id,
      validTill: expiresAt.toString(),
    };
    await this.chores.create(
      { token, taskData: payload, taskType: 'EMAIL_VERIFICATION', expiresAt },
      orm,
    );
    return payload;
  }

  private async sendVerificationEmail(payload: EmailVerificationTask): Promise<void> {
    await this.cache.set(payload.token, payload, EMAIL_VERIFICATION_TTL_MS);
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const link = `${frontendUrl}/verify-email?key=${payload.token}`;
    await this.queue.enqueue({
      type: 'email',
      data: {
        to: payload.email,
        subject: 'Email Verification',
        text: 'Please verify your email',
        html: emailVerificationTemplate(payload.email, link),
      },
    });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const verification = await this.db.client.transaction(
      async (tx): Promise<EmailVerificationTask | null> => {
        const user = await this.users.findByEmail(email, tx.orm);
        if (!user) {
          this.logger.log(`User not found for email: ${email}`);
          return null;
        }
        return await this.createVerificationChore(user, tx.orm);
      },
    );
    if (!verification) {
      return;
    }
    await this.sendVerificationEmail(verification);
  }
}
