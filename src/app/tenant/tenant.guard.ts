/**
 * Tenant context guard (HEADER-BASED — SUPERSEDED, dev/testing only).
 *
 * Production auth now uses {@link JwtAuthGuard} (Identity & Org module), which
 * derives org/user/role from a verified session token and attaches the same
 * {@link TenantContext} to the request. This header-based guard is retained as a
 * convenience for local testing without minting a token; do NOT mount it on
 * production routes. It also defines {@link RequestWithTenant}, the shared
 * request-augmentation type both guards populate.
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
