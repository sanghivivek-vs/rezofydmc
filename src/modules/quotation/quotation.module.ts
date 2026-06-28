/**
 * Quotation NestJS module (Build guide §4, §5). Wraps the framework-agnostic
 * Costing engine with persistence + HTTP, composing the Enquiry, Catalog, and
 * Identity/Org modules through their service interfaces.
 */

import { Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { LoggingAuditSink } from '@common/audit/logging-audit-sink';
import { type OutboundPublisher, OUTBOUND_PUBLISHER } from '@common/integration/outbound';
import { EnquiryService } from '@modules/enquiry-intake';
import { CatalogService } from '@modules/catalog';
import { OrgService } from '@modules/identity-org';
import { IdentityModule } from '../identity-org/identity.module';
import { EnquiryModule } from '../enquiry-intake/enquiry.module';
import { CatalogModule } from '../catalog/catalog.module';
import { IntegrationModule } from '../integration/integration.module';
import { QuoteController } from './api/quote.controller';
import { QUOTE_AUDIT_SINK, QUOTE_REPOSITORY } from './api/tokens';
import type { QuoteRepository } from './repository/quote.repository';
import { QuotationService } from './service/quotation.service';

@Module({
  imports: [IdentityModule, EnquiryModule, CatalogModule, IntegrationModule],
  controllers: [QuoteController],
  providers: [
    { provide: QUOTE_AUDIT_SINK, useClass: LoggingAuditSink },
    {
      provide: QuotationService,
      inject: [
        QUOTE_REPOSITORY,
        EnquiryService,
        CatalogService,
        OrgService,
        QUOTE_AUDIT_SINK,
        OUTBOUND_PUBLISHER,
      ],
      useFactory: (
        quotes: QuoteRepository,
        enquiries: EnquiryService,
        catalog: CatalogService,
        orgs: OrgService,
        audit: AuditSink,
        publisher: OutboundPublisher,
      ) =>
        new QuotationService({
          quotes,
          enquiries,
          catalog,
          orgs,
          audit,
          publisher,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
  ],
  exports: [QuotationService],
})
export class QuotationModule {}
