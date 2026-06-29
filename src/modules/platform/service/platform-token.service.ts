/**
 * Platform token service. Signs/verifies super-admin session tokens, carrying a
 * `scope: 'platform'` claim so a platform token can never be mistaken for a
 * tenant session token (and vice-versa). Same JWT secret, distinct audience.
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { resolveSecret } from '@common/config/secrets';

export interface PlatformClaims {
  readonly sub: string;
  readonly scope: 'platform';
}

@Injectable()
export class PlatformTokenService {
  private readonly secret: string;
  private readonly ttl: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = resolveSecret(config.get<string>('JWT_SECRET'), 'JWT_SECRET');
    this.ttl = config.get<string>('PLATFORM_JWT_TTL') ?? '8h';
  }

  sign(adminId: string): string {
    return this.jwt.sign(
      { scope: 'platform' },
      { subject: adminId, secret: this.secret, expiresIn: this.ttl },
    );
  }

  verify(token: string): PlatformClaims {
    const payload = this.jwt.verify<{ sub: string; scope?: string }>(token, {
      secret: this.secret,
    });
    if (payload.scope !== 'platform') {
      throw new Error('not a platform token');
    }
    return { sub: payload.sub, scope: 'platform' };
  }
}
