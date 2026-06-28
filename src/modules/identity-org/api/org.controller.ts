/**
 * Organization API (Build guide §4, §9). Reading the org is open to any
 * authenticated user; changing settings is Owner-only (server-side gate).
 */

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { OrgService } from '../service/org.service';
import type { OrgSettings } from '../domain/organization';

@Controller('v1/org')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgController {
  constructor(private readonly orgs: OrgService) {}

  @Get()
  async current(@CurrentTenant() ctx: TenantContext) {
    return this.orgs.getCurrent(ctx);
  }

  @Patch('settings')
  @Roles('Owner')
  async updateSettings(@CurrentTenant() ctx: TenantContext, @Body() body: Partial<OrgSettings>) {
    return this.orgs.updateSettings(ctx, body);
  }
}
