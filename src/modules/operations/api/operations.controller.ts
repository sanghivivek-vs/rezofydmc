/**
 * Operations API (Build guide §3 Operations, §10 Phase 2). Quote acceptance,
 * bookings + confirmation tracking, supplier POs, and the pipeline report.
 * JWT-secured; mutations gated to Owner/Sales/Ops.
 */

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { OperationsService } from '../service/operations.service';

const EDITORS = ['Owner', 'Sales', 'Ops'] as const;

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Post('v1/quotes/:id/accept')
  @Roles(...EDITORS)
  accept(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.ops.acceptQuote(ctx, id);
  }

  @Post('v1/quotes/:id/reject')
  @Roles(...EDITORS)
  async reject(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    await this.ops.rejectQuote(ctx, id);
    return { rejected: true };
  }

  @Get('v1/bookings')
  list(@CurrentTenant() ctx: TenantContext) {
    return this.ops.listBookings(ctx);
  }

  @Get('v1/bookings/:id')
  get(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.ops.getBooking(ctx, id);
  }

  @Post('v1/bookings/:id/items/:itemId/confirm')
  @Roles(...EDITORS)
  confirm(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { confirmationRef?: string },
  ) {
    if (!body?.confirmationRef) throw new ValidationError('confirmationRef is required');
    return this.ops.confirmItem(ctx, id, itemId, body.confirmationRef);
  }

  @Get('v1/bookings/:id/supplier-pos')
  supplierPOs(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.ops.supplierPOs(ctx, id);
  }

  @Get('v1/reports/pipeline')
  pipeline(@CurrentTenant() ctx: TenantContext) {
    return this.ops.pipelineReport(ctx);
  }
}
