/**
 * Consent gate (Build guide §4; GDPR — ADR 0008, decisions #11). Decides whether
 * a message may be sent to a recipient on a channel for a given audience.
 *
 * Internal audiences (team/actor — staff) are processed on a legitimate-interest
 * basis and are always allowed. External audiences (customer) are FAIL-CLOSED in
 * the default gate: they are denied until a consent-verifying gate and contact
 * resolution are wired, so the platform never messages a customer without proven
 * consent.
 */

import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { MessageChannel } from '@common/messaging/channel';
import type { NotificationAudience } from '@common/messaging/routing';

export interface ConsentDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface ConsentGate {
  allows(
    ctx: TenantContext,
    audience: NotificationAudience,
    channel: MessageChannel,
    subjectRef?: string,
  ): Promise<ConsentDecision>;
}

export const CONSENT_GATE = Symbol('CONSENT_GATE');

/** Internal allowed; external (customer) denied until consent is verifiable. */
@Injectable()
export class DefaultConsentGate implements ConsentGate {
  async allows(_ctx: TenantContext, audience: NotificationAudience): Promise<ConsentDecision> {
    if (audience === 'team' || audience === 'actor') return { allowed: true };
    return { allowed: false, reason: 'customer consent not verified (fail-closed)' };
  }
}
