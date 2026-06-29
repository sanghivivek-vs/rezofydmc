/**
 * NotificationAuditSink (Build guide §4, §9). An AuditSink that records every
 * audit event (structured logging) AND raises a notification for notifiable
 * actions. Binding this as the audit sink turns the existing audit stream into
 * the notification event source — producing modules are unchanged.
 */

import { Injectable, Optional } from '@nestjs/common';
import type { AuditEvent, AuditSink } from '@common/audit/audit-log';
import { LoggingAuditSink } from '@common/audit/logging-audit-sink';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcher } from './notification-dispatcher';

@Injectable()
export class NotificationAuditSink implements AuditSink {
  private readonly logging = new LoggingAuditSink();

  constructor(
    private readonly notifications: NotificationsService,
    @Optional() private readonly dispatcher?: NotificationDispatcher,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    await this.logging.record(event);
    // In-app notification (always) + external delivery via routing rules (when wired).
    await this.notifications.raiseFromAudit(event);
    if (this.dispatcher) await this.dispatcher.dispatch(event);
  }
}
