/**
 * Agency CRM API (Build guide §4). Agencies, their contacts, and interaction
 * history. JWT-secured; reads open to any tenant user, mutations gated to
 * Owner/Sales/Ops.
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { CrmService } from '../service/crm.service';
import type {
  CreateAgencyInput,
  CreateContactInput,
  LogInteractionInput,
  UpdateAgencyInput,
  UpdateContactInput,
} from '../domain/crm';

const EDITORS = ['Owner', 'Sales', 'Ops'] as const;

@Controller('v1/crm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('agencies')
  listAgencies(@CurrentTenant() ctx: TenantContext) {
    return this.crm.listAgencies(ctx);
  }

  @Post('agencies')
  @Roles(...EDITORS)
  createAgency(@CurrentTenant() ctx: TenantContext, @Body() body: CreateAgencyInput) {
    return this.crm.createAgency(ctx, body);
  }

  @Get('agencies/:id')
  getAgency(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.crm.getAgency(ctx, id);
  }

  @Patch('agencies/:id')
  @Roles(...EDITORS)
  updateAgency(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: UpdateAgencyInput,
  ) {
    return this.crm.updateAgency(ctx, id, body ?? {});
  }

  @Get('agencies/:id/contacts')
  listContacts(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.crm.listContacts(ctx, id);
  }

  @Post('agencies/:id/contacts')
  @Roles(...EDITORS)
  addContact(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: CreateContactInput,
  ) {
    return this.crm.addContact(ctx, id, body);
  }

  @Patch('contacts/:id')
  @Roles(...EDITORS)
  updateContact(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: UpdateContactInput,
  ) {
    return this.crm.updateContact(ctx, id, body ?? {});
  }

  @Delete('contacts/:id')
  @Roles(...EDITORS)
  async removeContact(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    await this.crm.removeContact(ctx, id);
    return { deleted: true };
  }

  @Get('agencies/:id/interactions')
  listInteractions(@CurrentTenant() ctx: TenantContext, @Param('id') id: string) {
    return this.crm.listInteractions(ctx, id);
  }

  @Post('agencies/:id/interactions')
  @Roles(...EDITORS)
  logInteraction(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: LogInteractionInput,
  ) {
    return this.crm.logInteraction(ctx, id, body);
  }
}
