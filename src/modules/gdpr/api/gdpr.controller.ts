/**
 * GDPR API (ADR 0008). Data-subject controls are sensitive: export, erasure,
 * consent, and retention sweeps are Owner-only and audited in the service. The
 * PII registry is readable by any authenticated tenant user (transparency).
 */

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { GdprService } from '../service/gdpr.service';
import type { RecordConsentInput } from '../domain/consent';

@Controller('v1/gdpr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  @Get('pii-registry')
  piiRegistry() {
    return this.gdpr.piiRegistry();
  }

  @Get('users/:id/export')
  @Roles('Owner')
  exportUser(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.gdpr.exportUser(ctx, id);
  }

  @Post('users/:id/erase')
  @Roles('Owner')
  async eraseUser(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    await this.gdpr.eraseUser(ctx, id);
    return { erased: true, subjectRef: id };
  }

  @Get('enquiries/:id/export')
  @Roles('Owner')
  exportEnquiry(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.gdpr.exportEnquiry(ctx, id);
  }

  @Post('enquiries/:id/erase')
  @Roles('Owner')
  async eraseEnquiry(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    await this.gdpr.eraseEnquiry(ctx, id);
    return { erased: true, subjectRef: id };
  }

  @Post('consent')
  @Roles('Owner', 'Sales', 'Ops')
  recordConsent(@CurrentTenant() ctx: TenantContext, @Body() body: RecordConsentInput) {
    return this.gdpr.recordConsent(ctx, body);
  }

  @Get('consent')
  @Roles('Owner')
  listConsent(@CurrentTenant() ctx: TenantContext, @Query('subjectRef') subjectRef?: string) {
    return this.gdpr.listConsent(ctx, subjectRef);
  }

  @Post('retention/sweep')
  @Roles('Owner')
  retentionSweep(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: { asOf?: string; retentionDays?: number },
  ) {
    if (typeof body?.retentionDays !== 'number') {
      throw new ValidationError('retentionDays (number) is required');
    }
    const asOf = body.asOf ?? new Date().toISOString();
    return this.gdpr.retentionSweep(ctx, asOf, body.retentionDays);
  }
}
