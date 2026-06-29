/**
 * Platform auth API. Bootstrap mints the first super-admin and is guarded by a
 * deploy secret (PLATFORM_BOOTSTRAP_SECRET) — it self-disables once an admin
 * exists. Login issues a platform session token. Both are unauthenticated by
 * design (they precede a session) but rate-limited.
 */

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ForbiddenError, ValidationError } from '@common/errors/errors';
import { resolveSecret } from '@common/config/secrets';
import { PlatformAuthService } from '../service/platform-auth.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('v1/platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  async bootstrap(
    @Headers('x-platform-bootstrap') secretHeader: string | undefined,
    @Body() body: { email?: string; name?: string; password?: string },
  ) {
    const expected = resolveSecret(
      this.config.get<string>('PLATFORM_BOOTSTRAP_SECRET'),
      'PLATFORM_BOOTSTRAP_SECRET',
    );
    if (!secretHeader || secretHeader !== expected) {
      throw new ForbiddenError('Invalid platform bootstrap secret');
    }
    if (!body?.email || !body?.name || !body?.password) {
      throw new ValidationError('email, name and password are required');
    }
    return this.auth.bootstrapFirstAdmin({
      email: body.email,
      name: body.name,
      password: body.password,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() body: { email?: string; password?: string }) {
    if (!body?.email || !body?.password) {
      throw new ValidationError('email and password are required');
    }
    const result = await this.auth.login(body.email, body.password);
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result;
  }
}
