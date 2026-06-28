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
export type { NotificationRepository } from './repository/notification.repository';
export { InMemoryNotificationRepository } from './repository/notification.repository';
export { NotificationsModule } from './notifications.module';
