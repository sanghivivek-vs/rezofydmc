/**
 * Notifications module — public interface (Build guide §4).
 */

export * from './domain/notification';
export {
  NotificationsService,
  type NotificationsServiceDeps,
} from './service/notifications.service';
export { type EmailSender, type EmailMessage, LoggingEmailSender } from './service/email-sender';
export { NotificationAuditSink } from './service/notification-audit-sink';
export { MessageService } from './service/message.service';
export { ProviderRegistry } from './service/providers/provider-factory';
export { type MessageProvider, LoggingMessageProvider } from './service/providers/provider';
export { NotificationDispatcher } from './service/notification-dispatcher';
export {
  CONSENT_GATE,
  DefaultConsentGate,
  type ConsentGate,
  type ConsentDecision,
} from './service/consent-gate';
export type { NotificationRepository } from './repository/notification.repository';
export { InMemoryNotificationRepository } from './repository/notification.repository';
export { NotificationsModule } from './notifications.module';
