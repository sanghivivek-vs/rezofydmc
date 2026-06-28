/**
 * `@CurrentTenant()` param decorator — extracts the TenantContext that
 * {@link TenantGuard} attached to the request.
 */

import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { RequestWithTenant } from './tenant.guard';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithTenant>();
    if (!req.tenant) {
      throw new UnauthorizedException('No tenant context on request');
    }
    return req.tenant;
  },
);
