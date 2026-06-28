/**
 * Enquiry (RFQ) entity — the incoming requirement from an agency (Build guide §3).
 *
 * Every Enquiry is tenant-scoped by `orgId` (Build guide §0, §9). Money fields
 * use integer minor units (Build guide §0).
 */

import type { Money } from '@common/money/money';
import type { TenantScoped, UserId } from '@common/tenancy/tenant-context';
import type { EnquiryStatus, TransportMode, EnquirySource } from './enums';

export interface ChildPax {
  /** Age in whole years at travel date. */
  readonly age: number;
}

export interface EnquiryPax {
  readonly adults: number;
  readonly children: ChildPax[];
  readonly infants: number;
}

export interface DateRange {
  readonly start: string; // ISO YYYY-MM-DD
  readonly end: string; // ISO YYYY-MM-DD
  readonly flexible: boolean;
}

export interface Rooming {
  readonly single: number;
  readonly double: number;
  readonly triple: number;
}

export interface TransportPreference {
  readonly mode: TransportMode;
  readonly coachSize?: number;
}

export interface Enquiry extends TenantScoped {
  readonly id: string;
  /** Stable shared id from the Tour Agency platform; absent for manual entries. */
  readonly enquiryExternalId?: string;
  readonly agencyId: string;
  readonly source: EnquirySource;

  readonly destinations: string[];
  readonly dateRange?: DateRange;
  readonly durationDays?: number;
  readonly pax: EnquiryPax;
  readonly rooming?: Rooming;
  readonly hotelCategory?: string;
  readonly namedHotels?: string[];
  readonly mealPreference?: string;
  readonly transportPreference?: TransportPreference;
  readonly budget?: Money;
  readonly mustSeeInclusions?: string[];
  readonly specialRequirements?: string;
  readonly quoteDeadline: string; // ISO date-time

  readonly status: EnquiryStatus;
  readonly assignedToUserId?: UserId;

  readonly createdAt: string; // ISO date-time UTC
  readonly updatedAt: string; // ISO date-time UTC
}

/**
 * Fields a caller supplies to create an enquiry. `orgId`, `id`, `source`,
 * `status`, and timestamps are set by the service, never the caller.
 */
export interface CreateEnquiryInput {
  readonly enquiryExternalId?: string;
  readonly agencyId: string;
  readonly destinations: string[];
  readonly dateRange?: DateRange;
  readonly durationDays?: number;
  readonly pax: EnquiryPax;
  readonly rooming?: Rooming;
  readonly hotelCategory?: string;
  readonly namedHotels?: string[];
  readonly mealPreference?: string;
  readonly transportPreference?: TransportPreference;
  readonly budget?: Money;
  readonly mustSeeInclusions?: string[];
  readonly specialRequirements?: string;
  readonly quoteDeadline: string;
}
