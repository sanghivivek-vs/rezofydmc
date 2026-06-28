/**
 * Tenant context guard (PROVISIONAL).
 *
 * Builds a {@link TenantContext} from request headers and attaches it to the
 * request. This is a placeholder until the Identity & Org module (Build guide
 * §4) issues real authenticated sessions / JWTs — at which point this guard is
 * replaced by one that derives org/user/role from a verified token. The
 * service/repository tenant-scoping contract (ADR 0004) is unchanged either way.
 *
 * Headers:
 *   x-org-id   (required) — the DMC tenant
 *   x-user-id  (required) — the acting user
 *   x-role     (optional, default ReadOnly) — Owner|Sales|Ops|Accounts|ReadOnly
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role, TenantContext } from '@common/tenancy/tenant-context';

const VALID_ROLES: Role[] = ['Owner', 'Sales', 'Ops', 'Accounts', 'ReadOnly'];

export interface RequestWithTenant extends Request {
  tenant?: TenantContext;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithTenant>();
    const orgId = header(req, 'x-org-id');
    const userId = header(req, 'x-user-id');
    if (!orgId || !userId) {
      throw new UnauthorizedException('Missing x-org-id or x-user-id');
    }
    const roleHeader = header(req, 'x-role');
    const role: Role = (VALID_ROLES as string[]).includes(roleHeader ?? '')
      ? (roleHeader as Role)
      : 'ReadOnly';
    const requestId = header(req, 'x-request-id');

    req.tenant = { orgId, userId, role, requestId };
    return true;
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}
