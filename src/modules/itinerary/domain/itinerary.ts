/**
 * Itinerary aggregate (Build guide §3, §10). An Itinerary belongs to an Enquiry,
 * is versioned, and contains days; each day contains timed Segments. This is the
 * structure that must reach the reference-itinerary fidelity: timed lines, a
 * type, supplier + booking status, and an optional link to a catalog Component.
 */

import type { TenantScoped } from '@common/tenancy/tenant-context';
import type { SegmentType } from './enums';

export interface Segment {
  readonly id: string;
  /** "HH:MM" 24h local trip time; optional (e.g. FreeTime). */
  readonly startTime?: string;
  readonly endTime?: string;
  readonly type: SegmentType;
  readonly description: string;
  readonly notes?: string;
  /** Optional link to a Catalog component (its rate is the cost reference). */
  readonly componentId?: string;
  /** Configurable per org (default: Confirmed, TM, Pending — Build guide §3). */
  readonly bookingStatus: string;
  readonly supplier?: string;
}

export interface ItineraryDay {
  readonly dayNumber: number;
  readonly date: string; // ISO YYYY-MM-DD
  readonly headline: string;
  readonly segments: Segment[];
}

export interface Itinerary extends TenantScoped {
  readonly id: string;
  readonly enquiryId: string;
  readonly version: number;
  readonly title?: string;
  readonly days: ItineraryDay[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateItineraryInput {
  readonly enquiryId: string;
  readonly title?: string;
}

export interface AddDayInput {
  readonly dayNumber: number;
  readonly date: string;
  readonly headline: string;
}

export interface AddSegmentInput {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly type: SegmentType;
  readonly description: string;
  readonly notes?: string;
  readonly componentId?: string;
  readonly bookingStatus?: string;
  readonly supplier?: string;
}
