/**
 * Role-based authorization (Build guide §9: authorization at the service
 * boundary). Runs after {@link JwtAuthGuard}, which has attached req.tenant.
 * A route with no @Roles metadata is allowed for any authenticated user.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@common/tenancy/tenant-context';
import type { RequestWithTenant } from '../tenant/tenant.guard';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithTenant>();
    if (!req.tenant) {
      throw new UnauthorizedException('No tenant context on request');
    }
    if (!required.includes(req.tenant.role)) {
      throw new ForbiddenException(`Requires role: ${required.join(' or ')}`);
    }
    return true;
  }
}
