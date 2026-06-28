/**
 * Notifications API (Build guide §4). Lists the tenant's in-app notifications and
 * marks them read. JWT-secured; readable by any authenticated tenant user.
 */

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { NotificationsService } from '../service/notifications.service';

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentTenant() ctx: TenantContext) {
    return this.notifications.list(ctx);
  }

  @Post(':id/read')
  markRead(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.notifications.markRead(ctx, id);
  }
}
