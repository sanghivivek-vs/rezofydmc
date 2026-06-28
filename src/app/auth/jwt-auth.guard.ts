/**
 * JWT auth guard — the real replacement for the provisional header-based
 * TenantGuard. Verifies the `Authorization: Bearer <token>` session token and
 * attaches the derived {@link TenantContext} to the request, so `@CurrentTenant`
 * and all downstream tenant scoping work unchanged.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { RequestWithTenant } from '../tenant/tenant.guard';
import { TOKEN_SERVICE } from '../../modules/identity-org/api/tokens';
import type { TokenService } from '../../modules/identity-org/service/token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithTenant>();
    const token = bearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    let claims;
    try {
      claims = this.tokens.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const requestId = req.headers['x-request-id'];
    const tenant: TenantContext = {
      orgId: claims.orgId,
      userId: claims.sub,
      role: claims.role,
      requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    };
    req.tenant = tenant;
    return true;
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme === 'Bearer' && value ? value : null;
}
