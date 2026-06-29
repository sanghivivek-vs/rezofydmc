/**
 * Notification routing rules (Build guide §4). Map an audit event type to the
 * audience and channels it should reach, so "who hears about what, and how" is
 * per-tenant configuration rather than code. Lives in the shared kernel so
 * Identity/Org (storage in org settings) and Notifications (dispatch) share it.
 */

import { type MessageChannel, isMessageChannel } from './channel';

/**
 * Who a rule targets:
 * - `team`   — all active staff users of the tenant (internal).
 * - `actor`  — the user who triggered the event (internal).
 * - `customer` — the end customer / agency contact (external data subject).
 *
 * Internal audiences are processed on a legitimate-interest basis. External
 * (customer) delivery is gated by the consent gate (GDPR — decisions #11) and is
 * fail-closed until a consent-verifying gate and contact resolution are wired.
 */
export type NotificationAudience = 'team' | 'actor' | 'customer';

export const NOTIFICATION_AUDIENCES: readonly NotificationAudience[] = [
  'team',
  'actor',
  'customer',
];

export interface RoutingRule {
  readonly event: string;
  readonly audience: NotificationAudience;
  readonly channels: MessageChannel[];
}

export function isAudience(value: unknown): value is NotificationAudience {
  return typeof value === 'string' && (NOTIFICATION_AUDIENCES as readonly string[]).includes(value);
}

export function normaliseRoutingRules(input: unknown): RoutingRule[] {
  if (!Array.isArray(input)) throw new Error('rules must be an array');
  return input.map((raw) => {
    const r = raw as Partial<RoutingRule>;
    if (typeof r.event !== 'string' || !r.event.trim()) throw new Error('rule.event is required');
    if (!isAudience(r.audience)) throw new Error(`Invalid audience: ${String(r.audience)}`);
    if (!Array.isArray(r.channels) || !r.channels.every(isMessageChannel)) {
      throw new Error('rule.channels must be a list of valid channels');
    }
    return { event: r.event.trim(), audience: r.audience, channels: [...r.channels] };
  });
}

/**
 * Sensible defaults: the team is notified over email about the events that the
 * audit stream already surfaces in-app. Customer-facing rules are intentionally
 * absent until consent + contact resolution land.
 */
export function defaultRoutingRules(): RoutingRule[] {
  return [
    { event: 'enquiry.status_changed', audience: 'team', channels: ['email'] },
    { event: 'quote.created', audience: 'team', channels: ['email'] },
    { event: 'quote.sent', audience: 'team', channels: ['email'] },
    { event: 'segment.status_changed', audience: 'team', channels: ['email'] },
  ];
}
