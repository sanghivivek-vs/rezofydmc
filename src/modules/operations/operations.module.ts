/**
 * Operations NestJS module (Build guide §4, §10 Phase 2). Booking repository
 * comes from the @Global persistence module (ADR 0009); the audit sink is bound
 * here. Composes Quotation, Catalog, and Enquiry via their interfaces.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { LoggingAuditSink } from '@common/audit/logging-audit-sink';
import { QuotationService } from '@modules/quotation';
import { CatalogService } from '@modules/catalog';
import { EnquiryService } from '@modules/enquiry-intake';
import { IdentityModule } from '../identity-org/identity.module';
import { QuotationModule } from '../quotation/quotation.module';
import { CatalogModule } from '../catalog/catalog.module';
import { EnquiryModule } from '../enquiry-intake/enquiry.module';
import { OperationsController } from './api/operations.controller';
import { QuoteDecisionWebhookController } from './api/quote-decision.webhook';
import { BOOKING_REPOSITORY, OPS_AUDIT_SINK } from './api/tokens';
import type { BookingRepository } from './repository/booking.repository';
import { OperationsService } from './service/operations.service';

@Module({
  imports: [ConfigModule, IdentityModule, QuotationModule, CatalogModule, EnquiryModule],
  controllers: [OperationsController, QuoteDecisionWebhookController],
  providers: [
    { provide: OPS_AUDIT_SINK, useClass: LoggingAuditSink },
    {
      provide: OperationsService,
      inject: [
        BOOKING_REPOSITORY,
        QuotationService,
        CatalogService,
        EnquiryService,
        OPS_AUDIT_SINK,
      ],
      useFactory: (
        bookings: BookingRepository,
        quotation: QuotationService,
        catalog: CatalogService,
        enquiries: EnquiryService,
        audit: AuditSink,
      ) =>
        new OperationsService({
          bookings,
          quotation,
          catalog,
          enquiries,
          audit,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
  ],
  exports: [OperationsService],
})
export class OperationsModule {}
