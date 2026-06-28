/**
 * Itinerary API (Build guide §3, §9). Mutations are gated to the catalog/sales
 * editors; reads are open to any authenticated tenant user.
 */

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { ItineraryService } from '../service/itinerary.service';
import type { AddDayInput, AddSegmentInput, CreateItineraryInput } from '../domain/itinerary';

const EDITORS = ['Owner', 'Sales', 'Ops'] as const;

@Controller('v1/itineraries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ItineraryController {
  constructor(private readonly itineraries: ItineraryService) {}

  @Post()
  @Roles(...EDITORS)
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateItineraryInput) {
    if (!body?.enquiryId) throw new ValidationError('enquiryId is required');
    return this.itineraries.create(ctx, body);
  }

  @Get(':id')
  async getById(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.itineraries.getById(ctx, id);
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext, @Query('enquiryId') enquiryId: string) {
    if (!enquiryId) throw new ValidationError('enquiryId query parameter is required');
    return this.itineraries.listByEnquiry(ctx, enquiryId);
  }

  @Post(':id/days')
  @Roles(...EDITORS)
  async addDay(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: AddDayInput,
  ) {
    return this.itineraries.addDay(ctx, id, body);
  }

  @Post(':id/days/:dayNumber/segments')
  @Roles(...EDITORS)
  async addSegment(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Param('dayNumber') dayNumber: string,
    @Body() body: AddSegmentInput,
  ) {
    return this.itineraries.addSegment(ctx, id, Number(dayNumber), body);
  }

  @Patch(':id/segments/:segmentId/status')
  @Roles(...EDITORS)
  async updateSegmentStatus(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
    @Body() body: { bookingStatus: string },
  ) {
    if (!body?.bookingStatus) throw new ValidationError('bookingStatus is required');
    return this.itineraries.updateSegmentStatus(ctx, id, segmentId, body.bookingStatus);
  }
}
