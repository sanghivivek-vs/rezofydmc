/**
 * Enquiry Intake NestJS module — wires controllers, the service, and swappable
 * infrastructure (repository, idempotency store, audit sink).
 *
 * Infrastructure is bound to in-memory implementations by default. When the
 * Prisma persistence layer is generated (DB + network available), swap the
 * repository/idempotency/audit providers for their Prisma-backed equivalents —
 * the service and controllers are unchanged (ADR 0002, ADR 0004).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { AuditSink } from '@common/audit/audit-log';
import { LoggingAuditSink } from '@common/audit/logging-audit-sink';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { EnquiryService } from './service/enquiry.service';
import { EnquiryController } from './api/enquiry.controller';
import { EnquiryWebhookController } from './api/webhook.controller';
import { AUDIT_SINK, ENQUIRY_REPOSITORY, IDEMPOTENCY_STORE } from './api/tokens';
import type { EnquiryRepository } from './repository/enquiry.repository';
import { InMemoryEnquiryRepository } from './repository/in-memory-enquiry.repository';
import { InMemoryIdempotencyStore } from './repository/idempotency-store';

@Module({
  imports: [ConfigModule],
  controllers: [EnquiryController, EnquiryWebhookController],
  providers: [
    { provide: ENQUIRY_REPOSITORY, useClass: InMemoryEnquiryRepository },
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
    { provide: AUDIT_SINK, useClass: LoggingAuditSink },
    {
      provide: EnquiryService,
      inject: [ENQUIRY_REPOSITORY, AUDIT_SINK],
      useFactory: (repository: EnquiryRepository, audit: AuditSink) =>
        new EnquiryService({
          repository,
          audit,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
  ],
})
export class EnquiryModule {}
