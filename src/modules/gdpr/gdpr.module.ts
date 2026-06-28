/**
 * GDPR NestJS module (ADR 0008). Composes Identity/Org, Enquiry, and Itinerary
 * via their service interfaces to provide data-subject controls.
 */

import { Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { LoggingAuditSink } from '@common/audit/logging-audit-sink';
import { UserService } from '@modules/identity-org';
import { EnquiryService } from '@modules/enquiry-intake';
import { ItineraryService } from '@modules/itinerary';
import { IdentityModule } from '../identity-org/identity.module';
import { EnquiryModule } from '../enquiry-intake/enquiry.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { GdprController } from './api/gdpr.controller';
import { CONSENT_REPOSITORY, GDPR_AUDIT_SINK } from './api/tokens';
import type { ConsentRepository } from './repository/consent.repository';
import { GdprService } from './service/gdpr.service';

@Module({
  imports: [IdentityModule, EnquiryModule, ItineraryModule],
  controllers: [GdprController],
  providers: [
    { provide: GDPR_AUDIT_SINK, useClass: LoggingAuditSink },
    {
      provide: GdprService,
      inject: [UserService, EnquiryService, ItineraryService, CONSENT_REPOSITORY, GDPR_AUDIT_SINK],
      useFactory: (
        users: UserService,
        enquiries: EnquiryService,
        itineraries: ItineraryService,
        consent: ConsentRepository,
        audit: AuditSink,
      ) =>
        new GdprService({
          users,
          enquiries,
          itineraries,
          consent,
          audit,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
  ],
  exports: [GdprService],
})
export class GdprModule {}
