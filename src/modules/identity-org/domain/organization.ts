/**
 * Organization (the DMC tenant) and its settings (Build guide §3 Tenancy, §5).
 *
 * Org settings carry the costing defaults the Quotation engine reads — default
 * currency and default markup — and the configurable segment booking-status set
 * (Build guide §3: "configurable per org, default: Confirmed, TM, Pending").
 */

import type { CurrencyCode } from '@common/money/money';
import type { OrgId } from '@common/tenancy/tenant-context';

export interface OrgSettings {
  readonly defaultCurrency: CurrencyCode;
  /** Org-wide default markup percent (Costing engine fallback — §5). */
  readonly defaultMarkupPercent: number;
  /** Configurable segment booking statuses (§3). */
  readonly bookingStatuses: string[];
}

export interface Organization {
  readonly id: OrgId;
  readonly name: string;
  readonly settings: OrgSettings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateOrgInput {
  readonly name: string;
  readonly defaultCurrency: CurrencyCode;
  readonly defaultMarkupPercent?: number;
  readonly bookingStatuses?: string[];
}

export const DEFAULT_BOOKING_STATUSES = ['Confirmed', 'TM', 'Pending'];
