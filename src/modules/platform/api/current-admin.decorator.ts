import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { RequestWithPlatformAdmin } from './platform-auth.guard';

/** Injects the authenticated platform admin id (set by PlatformAuthGuard). */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<RequestWithPlatformAdmin>();
    return req.platformAdminId ?? '';
  },
);
