/**
 * Enquiry REST API (Build guide §6, §9). Versioned under /v1/enquiries.
 *
 * Controllers contain NO business logic — they validate/shape input and delegate
 * to {@link EnquiryService} (Build guide §9 layering). Every route is tenant-
 * scoped via {@link TenantGuard} + {@link CurrentTenant}.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { TenantGuard } from '../../../app/tenant/tenant.guard';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { EnquiryService } from '../service/enquiry.service';
import {
  type AssignDto,
  type ChangeStatusDto,
  type CreateEnquiryDto,
  toCreateEnquiryInput,
} from './dto';

@Controller('v1/enquiries')
@UseGuards(TenantGuard)
export class EnquiryController {
  constructor(private readonly enquiries: EnquiryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateEnquiryDto) {
    return this.enquiries.createManual(ctx, toCreateEnquiryInput(body));
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext) {
    return this.enquiries.list(ctx);
  }

  @Get(':id')
  async getById(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.enquiries.getById(ctx, id);
  }

  @Post(':id/assign')
  async assign(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: AssignDto,
  ) {
    return this.enquiries.assign(ctx, id, body.userId);
  }

  @Post(':id/status')
  async changeStatus(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: ChangeStatusDto,
  ) {
    return this.enquiries.changeStatus(ctx, id, body.status);
  }
}
