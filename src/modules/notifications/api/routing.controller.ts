/**
 * Routing-rules API (Build guide §4). Owners configure which event reaches which
 * audience over which channels. Reading is open to any tenant user; writing is
 * Owner-only (server-side gate, §9).
 */

import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { type RoutingRule, defaultRoutingRules } from '@common/messaging/routing';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { OrgService } from '../../identity-org/service/org.service';

@Controller('v1/notifications/rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutingController {
  constructor(private readonly orgs: OrgService) {}

  @Get()
  async get(@CurrentTenant() ctx: TenantContext): Promise<RoutingRule[]> {
    const org = await this.orgs.getCurrent(ctx);
    return org.settings.notificationRules ?? defaultRoutingRules();
  }

  @Put()
  @Roles('Owner')
  async update(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: { rules?: RoutingRule[] },
  ): Promise<RoutingRule[]> {
    const org = await this.orgs.updateSettings(ctx, { notificationRules: body?.rules ?? [] });
    return org.settings.notificationRules ?? [];
  }
}
