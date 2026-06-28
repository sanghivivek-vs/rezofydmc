/**
 * Document API (Build guide §4 Documents, §10). Returns rendered documents
 * (HTML by default). The client quote document is readable by any authenticated
 * tenant user; the costing sheet is Owner-only.
 */

import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { DocumentService } from '../service/document.service';
import type { RenderedDocument } from '../domain/document';

@Controller('v1/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get(':id/document')
  async quoteDocument(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return emit(res, await this.documents.clientQuoteDocument(ctx, id));
  }

  @Get(':id/costing-sheet')
  @Roles('Owner')
  async costingSheet(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    return emit(res, await this.documents.costingSheet(ctx, id));
  }
}

function emit(res: Response, doc: RenderedDocument): string {
  res.setHeader('Content-Type', doc.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
  return doc.body;
}
