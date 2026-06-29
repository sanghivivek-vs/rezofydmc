/**
 * Notifications NestJS module (Build guide §4). @Global: it binds EVERY module's
 * audit-sink token to {@link NotificationAuditSink}, so all audited business
 * events flow through notifications (in-app + email) with no change to producing
 * modules. The notification repository comes from the @Global persistence module
 * (in-memory by default, Prisma in a DB env — ADR 0009).
 */

import { Global, Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { IdentityModule } from '../identity-org/identity.module';
import { AUDIT_SINK } from '@modules/enquiry-intake/api/tokens';
import { QUOTE_AUDIT_SINK } from '@modules/quotation/api/tokens';
import { ITINERARY_AUDIT_SINK } from '@modules/itinerary/api/tokens';
import { GDPR_AUDIT_SINK } from '@modules/gdpr/api/tokens';
import { OPS_AUDIT_SINK } from '@modules/operations/api/tokens';
import { NotificationsController } from './api/notifications.controller';
import { ChannelsController } from './api/channels.controller';
import { EMAIL_SENDER, NOTIFICATION_REPOSITORY } from './api/tokens';
import { LoggingEmailSender, type EmailSender } from './service/email-sender';
import { NotificationsService } from './service/notifications.service';
import { NotificationAuditSink } from './service/notification-audit-sink';
import { MessageService } from './service/message.service';
import { ProviderRegistry } from './service/providers/provider-factory';
import type { NotificationRepository } from './repository/notification.repository';

const AUDIT_TOKENS = [
  AUDIT_SINK,
  QUOTE_AUDIT_SINK,
  ITINERARY_AUDIT_SINK,
  GDPR_AUDIT_SINK,
  OPS_AUDIT_SINK,
];

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [NotificationsController, ChannelsController],
  providers: [
    ProviderRegistry,
    MessageService,
    { provide: EMAIL_SENDER, useClass: LoggingEmailSender },
    {
      provide: NotificationsService,
      inject: [NOTIFICATION_REPOSITORY, EMAIL_SENDER],
      useFactory: (repository: NotificationRepository, email: EmailSender) =>
        new NotificationsService({
          repository,
          email,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
    NotificationAuditSink,
    // Every feature module's audit-sink token resolves to the same instance.
    ...AUDIT_TOKENS.map((token) => ({ provide: token, useExisting: NotificationAuditSink })),
  ],
  exports: [NotificationsService, NotificationAuditSink, MessageService, ...AUDIT_TOKENS],
})
export class NotificationsModule {}
