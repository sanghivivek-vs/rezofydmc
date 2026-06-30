/**
 * Voucher API (Build guide §4 Documents, §10 Operations). Renders a branded
 * service voucher for a booking (HTML by default). Readable by any authenticated
 * tenant user; sell-side only (no cost/margin).
 */

import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { DocumentService } from '../service/document.service';
import type { RenderedDocument } from '../domain/document';

@Controller('v1/bookings')
@UseGuards(JwtAuthGuard)
export class VoucherController {
  constructor(private readonly documents: DocumentService) {}

  @Get(':id/voucher')
  async voucher(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const doc: RenderedDocument = await this.documents.bookingVoucher(ctx, id);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    return doc.body;
  }
}
