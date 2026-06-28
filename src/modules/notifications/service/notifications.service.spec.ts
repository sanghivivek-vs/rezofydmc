import { NotificationsService } from './notifications.service';
import { NotificationAuditSink } from './notification-audit-sink';
import { InMemoryNotificationRepository } from '../repository/notification.repository';
import type { EmailMessage, EmailSender } from './email-sender';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import type { AuditEvent } from '@common/audit/audit-log';
import type { TenantContext } from '@common/tenancy/tenant-context';

class FakeEmail implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<void> {
    this.sent.push(m);
  }
}

const ctx: TenantContext = { orgId: 'org-A', userId: 'u1', role: 'Owner' };

function make() {
  const email = new FakeEmail();
  const service = new NotificationsService({
    repository: new InMemoryNotificationRepository(),
    email,
    clock: fixedClock('2026-06-28T10:00:00.000Z'),
    idGenerator: sequentialIdGenerator(),
  });
  return { service, email };
}

function event(action: AuditEvent['action'], after?: Record<string, unknown>): AuditEvent {
  return {
    orgId: 'org-A',
    actorId: 'u1',
    action,
    subject: { type: 'Quote', id: 'q1' },
    after,
    at: '2026-06-28T10:00:00.000Z',
  };
}

describe('NotificationsService', () => {
  it('raises an in-app notification + email for a notifiable audit event', async () => {
    const { service, email } = make();
    const n = await service.raiseFromAudit(event('quote.sent'));
    expect(n).not.toBeNull();
    expect(n?.message).toMatch(/sent to the agency/);
    expect(await service.list(ctx)).toHaveLength(1);
    expect(email.sent).toHaveLength(1);
  });

  it('phrases enquiry/segment status changes from the audit payload', async () => {
    const { service } = make();
    const e = await service.raiseFromAudit({
      ...event('enquiry.status_changed', { status: 'Won' }),
      subject: { type: 'Enquiry', id: 'e1' },
    });
    expect(e?.message).toBe('Enquiry e1 → Won');
  });

  it('ignores non-notifiable actions', async () => {
    const { service } = make();
    expect(await service.raiseFromAudit(event('data.exported'))).toBeNull();
    expect(await service.list(ctx)).toHaveLength(0);
  });

  it('marks a notification read', async () => {
    const { service } = make();
    const n = await service.raiseFromAudit(event('quote.created'));
    const read = await service.markRead(ctx, n!.id);
    expect(read.read).toBe(true);
  });

  it('NotificationAuditSink raises from the audit stream and never throws', async () => {
    const { service } = make();
    const sink = new NotificationAuditSink(service);
    await sink.record(event('quote.created'));
    expect(await service.list(ctx)).toHaveLength(1);
  });
});
