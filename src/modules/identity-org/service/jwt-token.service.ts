/**
 * JWT-backed {@link TokenService} (HS256 via @nestjs/jwt). Secret and TTL come
 * from config (JWT_SECRET, JWT_TTL — default 12h).
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { resolveSecret } from '@common/config/secrets';
import type { Role } from '@common/tenancy/tenant-context';
import type { AuthClaims, TokenService } from './token.service';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly secret: string;
  private readonly ttl: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    // Fail-closed: a missing JWT secret is a hard error in production (ADR 0007).
    this.secret = resolveSecret(config.get<string>('JWT_SECRET'), 'JWT_SECRET');
    this.ttl = config.get<string>('JWT_TTL') ?? '12h';
  }

  sign(claims: AuthClaims): string {
    return this.jwt.sign(
      { orgId: claims.orgId, role: claims.role },
      { subject: claims.sub, secret: this.secret, expiresIn: this.ttl },
    );
  }

  verify(token: string): AuthClaims {
    const payload = this.jwt.verify<{ sub: string; orgId: string; role: Role }>(token, {
      secret: this.secret,
    });
    return { sub: payload.sub, orgId: payload.orgId, role: payload.role };
  }
}
