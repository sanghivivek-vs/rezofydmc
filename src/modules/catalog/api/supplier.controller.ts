import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { CatalogService } from '../service/catalog.service';
import type { CreateSupplierDto } from './dto';

/** Roles permitted to mutate the catalog (ReadOnly/Accounts may only read). */
export const CATALOG_EDITORS = ['Owner', 'Sales', 'Ops'] as const;

@Controller('v1/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @Roles(...CATALOG_EDITORS)
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateSupplierDto) {
    return this.catalog.createSupplier(ctx, body);
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext) {
    return this.catalog.listSuppliers(ctx);
  }

  @Get(':id')
  async get(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.catalog.getSupplier(ctx, id);
  }
}
