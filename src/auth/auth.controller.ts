import { AuthService } from '@/auth/auth.service.js';
import { CookieService } from '@/auth/cookie.service.js';
import { CurrentUser } from '@/auth/decorators/current-user.decorator.js';
import { DeviceHeaders, type DeviceInfo } from '@/auth/decorators/device-headers.decorator.js';
import { LoginDto } from '@/auth/dto/login.dto.js';
import { RegisterDto } from '@/auth/dto/register.dto.js';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto.js';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard.js';
import type { AuthTokenPayload } from '@/auth/token-payload.schema.js';
import { ResponseMessage } from '@/common/decorators/response-message.decorator.js';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

// Brute-force targets get a much tighter limit than the global 60/min.
const STRICT_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
  ) {}

  @Post('register')
  @Throttle(STRICT_LIMIT)
  @ResponseMessage('Registered successfully')
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_LIMIT)
  @ResponseMessage('Logged in successfully')
  async login(
    @Body() dto: LoginDto,
    @DeviceHeaders() device: DeviceInfo,
    // passthrough: set cookies on the response, but still let Nest send the return value.
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const tokens = await this.auth.login(dto, device);
    this.cookies.setAuthCookie(response, tokens.authToken);
    this.cookies.setRefreshCookie(response, tokens.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ResponseMessage('Logged out successfully')
  async logout(
    @CurrentUser() user: AuthTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(user.userId);
    this.cookies.clearCookies(response);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(STRICT_LIMIT)
  @ResponseMessage('Email verified successfully')
  async verifyEmail(@Query() query: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(query.key);
  }
}
