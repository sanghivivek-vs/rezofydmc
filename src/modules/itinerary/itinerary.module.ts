/**
 * Itinerary Builder NestJS module (Build guide §4). In-memory infrastructure by
 * default; composes Enquiry, Catalog, and Identity/Org via their interfaces.
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
import { ItineraryController } from './api/itinerary.controller';
import { ITINERARY_AUDIT_SINK, ITINERARY_REPOSITORY } from './api/tokens';
import type { ItineraryRepository } from './repository/itinerary.repository';
import { ItineraryService } from './service/itinerary.service';

@Module({
  imports: [IdentityModule, EnquiryModule, CatalogModule, IntegrationModule],
  controllers: [ItineraryController],
  providers: [
    { provide: ITINERARY_AUDIT_SINK, useClass: LoggingAuditSink },
    {
      provide: ItineraryService,
      inject: [
        ITINERARY_REPOSITORY,
        EnquiryService,
        CatalogService,
        OrgService,
        ITINERARY_AUDIT_SINK,
        OUTBOUND_PUBLISHER,
      ],
      useFactory: (
        repository: ItineraryRepository,
        enquiries: EnquiryService,
        catalog: CatalogService,
        orgs: OrgService,
        audit: AuditSink,
        publisher: OutboundPublisher,
      ) =>
        new ItineraryService({
          repository,
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
  exports: [ItineraryService],
})
export class ItineraryModule {}
