/**
 * Quote API (Build guide §5, §6, §9). Pricing a quote is a mutation, gated to
 * the catalog/sales editors; reads are open to any authenticated tenant user.
 * The owner-only margin view is stripped server-side by the service.
 */

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { QuotationService } from '../service/quotation.service';
import type { CreateQuoteInput } from '../domain/quote';

@Controller('v1/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteController {
  constructor(private readonly quotes: QuotationService) {}

  @Post()
  @Roles('Owner', 'Sales', 'Ops')
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateQuoteInput) {
    if (!body?.enquiryId) {
      throw new ValidationError('enquiryId is required');
    }
    return this.quotes.createQuote(ctx, body);
  }

  @Get(':id')
  async getById(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.quotes.getById(ctx, id);
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext, @Query('enquiryId') enquiryId: string) {
    if (!enquiryId) {
      throw new ValidationError('enquiryId query parameter is required');
    }
    return this.quotes.listByEnquiry(ctx, enquiryId);
  }
}
