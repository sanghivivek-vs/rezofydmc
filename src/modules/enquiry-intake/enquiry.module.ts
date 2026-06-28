/**
 * Enquiry Intake NestJS module — wires controllers and the service. The
 * repository, idempotency store, and audit sink all come from @Global modules
 * (persistence — ADR 0009; audit sink — the Notifications module).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../identity-org/identity.module';
import type { AuditSink } from '@common/audit/audit-log';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { EnquiryService } from './service/enquiry.service';
import { EnquiryController } from './api/enquiry.controller';
import { EnquiryWebhookController } from './api/webhook.controller';
import { AUDIT_SINK, ENQUIRY_REPOSITORY } from './api/tokens';
import type { EnquiryRepository } from './repository/enquiry.repository';

@Module({
  imports: [ConfigModule, IdentityModule],
  controllers: [EnquiryController, EnquiryWebhookController],
  providers: [
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
  exports: [EnquiryService],
})
export class EnquiryModule {}
