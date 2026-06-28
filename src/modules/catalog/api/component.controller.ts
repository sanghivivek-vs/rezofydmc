import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { CatalogService } from '../service/catalog.service';
import { CATALOG_EDITORS } from './supplier.controller';
import { type CreateComponentDto, type CreateRateDto, toCreateRateInput } from './dto';

@Controller('v1/components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComponentController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @Roles(...CATALOG_EDITORS)
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateComponentDto) {
    return this.catalog.createComponent(ctx, body);
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext) {
    return this.catalog.listComponents(ctx);
  }

  @Get(':id')
  async get(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.catalog.getComponent(ctx, id);
  }

  @Post(':id/rates')
  @Roles(...CATALOG_EDITORS)
  async addRate(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: CreateRateDto,
  ) {
    return this.catalog.addRate(ctx, toCreateRateInput(id, body));
  }

  @Get(':id/rates')
  async listRates(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.catalog.listRates(ctx, id);
  }
}
