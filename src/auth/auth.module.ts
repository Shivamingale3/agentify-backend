import { CookieService } from '@/auth/cookie.service.js';
import { SessionService } from '@/auth/session.service.js';
import type { Env } from '@/config/env/env.schema.js';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        // Pin the algorithm both ways: a token can't pick a weaker one (or "none") for itself.
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [SessionService, CookieService],
})
export class AuthModule {}
