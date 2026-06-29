/**
 * Organization (the DMC tenant) and its settings (Build guide §3 Tenancy, §5).
 *
 * Org settings carry the costing defaults the Quotation engine reads — default
 * currency and default markup — and the configurable segment booking-status set
 * (Build guide §3: "configurable per org, default: Confirmed, TM, Pending").
 */

import type { CurrencyCode } from '@common/money/money';
import type { OrgId } from '@common/tenancy/tenant-context';
import type { ChannelConfig } from '@common/messaging/channel';
import type { RoutingRule } from '@common/messaging/routing';

export interface OrgSettings {
  readonly defaultCurrency: CurrencyCode;
  /** Org-wide default markup percent (Costing engine fallback — §5). */
  readonly defaultMarkupPercent: number;
  /** Configurable segment booking statuses (§3). */
  readonly bookingStatuses: string[];
  /**
   * Per-tenant messaging channel configuration (email/SMS/WhatsApp providers).
   * Optional for backward compatibility; absent means "no channels configured".
   */
  readonly channels?: ChannelConfig[];
  /**
   * Per-tenant routing rules (which event reaches which audience over which
   * channels). Absent means the in-code defaults apply.
   */
  readonly notificationRules?: RoutingRule[];
  /**
   * Tenant self-serve switch to message its own customers/partners. Effective
   * only when the platform also allows it (governance.customerMessagingAllowed).
   */
  readonly customerMessagingEnabled?: boolean;
}

export type OrgStatus = 'active' | 'suspended';

/**
 * Platform-level governance of a tenant. NOT tenant-editable — only platform
 * super-admins change these. Kept separate from `settings` (which the tenant
 * Owner can PUT) so a tenant can never lift its own restrictions.
 */
export interface OrgGovernance {
  /** Platform override: may this tenant message its customers at all? */
  readonly customerMessagingAllowed: boolean;
}

export function defaultGovernance(): OrgGovernance {
  return { customerMessagingAllowed: false };
}

export interface Organization {
  readonly id: OrgId;
  readonly name: string;
  readonly status: OrgStatus;
  readonly settings: OrgSettings;
  readonly governance: OrgGovernance;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** True when a tenant may actually message customers (platform AND tenant agree). */
export function customerMessagingEffective(org: Organization): boolean {
  return org.governance.customerMessagingAllowed && org.settings.customerMessagingEnabled === true;
}

export interface CreateOrgInput {
  readonly name: string;
  readonly defaultCurrency: CurrencyCode;
  readonly defaultMarkupPercent?: number;
  readonly bookingStatuses?: string[];
}

export const DEFAULT_BOOKING_STATUSES = ['Confirmed', 'TM', 'Pending'];
