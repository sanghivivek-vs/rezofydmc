/**
 * Notifications service (Build guide §4). Persists in-app notifications and sends
 * email (best-effort). Notifications are raised from the audit stream by
 * {@link NotificationAuditSink}, so producing modules need no changes.
 */

import { type TenantContext } from '@common/tenancy/tenant-context';
import { NotFoundError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditEvent } from '@common/audit/audit-log';
import { type Notification, notificationMessage } from '../domain/notification';
import type { NotificationRepository } from '../repository/notification.repository';
import type { EmailSender } from './email-sender';

export interface NotificationsServiceDeps {
  readonly repository: NotificationRepository;
  readonly email: EmailSender;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class NotificationsService {
  private readonly repo: NotificationRepository;
  private readonly email: EmailSender;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(deps: NotificationsServiceDeps) {
    this.repo = deps.repository;
    this.email = deps.email;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
  }

  /**
   * Create a notification from an audit event, if the action is notifiable.
   * Returns the created notification or null. Never throws — a notification
   * failure must not break the audited business operation.
   */
  async raiseFromAudit(event: AuditEvent): Promise<Notification | null> {
    const message = notificationMessage(event);
    if (!message) return null;
    try {
      const ctx: TenantContext = { orgId: event.orgId, userId: event.actorId, role: 'Ops' };
      const notification: Notification = {
        id: this.newId('ntf'),
        orgId: event.orgId,
        type: event.action,
        subject: event.subject,
        message,
        read: false,
        createdAt: event.at || this.clock(),
      };
      const saved = await this.repo.create(ctx, notification);
      await this.email.send({ to: `org:${event.orgId}`, subject: event.action, body: message });
      return saved;
    } catch {
      return null;
    }
  }

  /**
   * Create an in-app notification directly (not derived from an audit event).
   * Used by platform broadcasts to reach a tenant's in-app feed.
   */
  async raiseDirect(
    orgId: string,
    type: string,
    subject: { type: string; id: string },
    message: string,
  ): Promise<Notification> {
    const ctx: TenantContext = { orgId, userId: 'platform', role: 'Owner' };
    const notification: Notification = {
      id: this.newId('ntf'),
      orgId,
      type,
      subject,
      message,
      read: false,
      createdAt: this.clock(),
    };
    return this.repo.create(ctx, notification);
  }

  async list(ctx: TenantContext): Promise<Notification[]> {
    return this.repo.list(ctx);
  }

  async markRead(ctx: TenantContext, id: string): Promise<Notification> {
    const updated = await this.repo.markRead(ctx, id);
    if (!updated) throw new NotFoundError(`Notification ${id} not found`, { id });
    return updated;
  }
}
