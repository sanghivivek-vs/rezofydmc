/**
 * NotificationDispatcher (Build guide §4). Turns an audit event into outbound
 * messages: it looks up the tenant's routing rules for the event, resolves the
 * recipients for each rule's audience, gates external sends through the consent
 * gate, and delivers via {@link MessageService} on the tenant's enabled channels.
 *
 * It never throws — a delivery problem must not break the audited business write.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { AuditEvent } from '@common/audit/audit-log';
import type { DeliveryResult, MessageChannel } from '@common/messaging/channel';
import type { NotificationAudience } from '@common/messaging/routing';
import { OrgService } from '../../identity-org/service/org.service';
import { UserService } from '../../identity-org/service/user.service';
import { notificationMessage } from '../domain/notification';
import { MessageService } from './message.service';
import { CONSENT_GATE, type ConsentGate } from './consent-gate';

interface Recipient {
  readonly email?: string;
  readonly phone?: string;
  /** Subject reference for consent lookups (external audiences). */
  readonly subjectRef?: string;
}

@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly orgs: OrgService,
    private readonly users: UserService,
    private readonly messages: MessageService,
    @Inject(CONSENT_GATE) private readonly consent: ConsentGate,
  ) {}

  async dispatch(event: AuditEvent): Promise<DeliveryResult[]> {
    try {
      const body = notificationMessage(event);
      if (!body) return [];

      // System context scoped to the event's org (reads are org-scoped only).
      const ctx: TenantContext = { orgId: event.orgId, userId: event.actorId, role: 'Owner' };
      const org = await this.orgs.getCurrent(ctx);
      const channels = org.settings.channels ?? [];
      const rules = (org.settings.notificationRules ?? []).filter((r) => r.event === event.action);
      if (rules.length === 0) return [];

      const subject = `DMC: ${event.subject.type} update`;
      const results: DeliveryResult[] = [];

      for (const rule of rules) {
        const recipients = await this.resolve(ctx, rule.audience, event);
        for (const channel of rule.channels) {
          for (const recipient of recipients) {
            const to = addressFor(channel, recipient);
            if (!to) continue;
            const decision = await this.consent.allows(
              ctx,
              rule.audience,
              channel,
              recipient.subjectRef,
            );
            if (!decision.allowed) {
              results.push({
                channel,
                provider: 'logging',
                to,
                status: 'skipped',
                detail: decision.reason,
              });
              continue;
            }
            results.push(await this.messages.send(channels, { channel, to, subject, body }));
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  private async resolve(
    ctx: TenantContext,
    audience: NotificationAudience,
    event: AuditEvent,
  ): Promise<Recipient[]> {
    if (audience === 'team') {
      const users = await this.users.list(ctx);
      return users.filter((u) => u.status === 'active').map((u) => ({ email: u.email }));
    }
    if (audience === 'actor') {
      const users = await this.users.list(ctx);
      const actor = users.find((u) => u.id === event.actorId && u.status === 'active');
      return actor ? [{ email: actor.email }] : [];
    }
    // 'customer' — external contact resolution is a future slice (agency-crm).
    return [];
  }
}

function addressFor(channel: MessageChannel, recipient: Recipient): string | undefined {
  return channel === 'email' ? recipient.email : recipient.phone;
}
