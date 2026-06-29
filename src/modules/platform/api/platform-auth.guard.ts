/**
 * PlatformAuthGuard — protects super-admin routes. Verifies the bearer token is a
 * valid *platform* token (scope=platform) and attaches the admin id to the
 * request. Distinct from the tenant JwtAuthGuard: a tenant session token is
 * rejected here, and a platform token carries no tenant context.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PlatformTokenService } from '../service/platform-token.service';

export interface RequestWithPlatformAdmin extends Request {
  platformAdminId?: string;
}

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly tokens: PlatformTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithPlatformAdmin>();
    const header = req.headers.authorization;
    const [scheme, value] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !value) {
      throw new UnauthorizedException('Missing platform bearer token');
    }
    try {
      req.platformAdminId = this.tokens.verify(value).sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired platform token');
    }
    return true;
  }
}
