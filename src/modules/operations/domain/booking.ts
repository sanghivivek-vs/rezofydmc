/**
 * Booking aggregate (Build guide §3 Operations, §10 Phase 2). Created when a
 * quote is accepted: one BookingItem per included component, each confirmed with
 * its supplier. When every item is Confirmed, the Booking is Confirmed.
 */

import type { TenantScoped, UserId } from '@common/tenancy/tenant-context';

export type BookingStatus = 'Confirming' | 'Confirmed' | 'Cancelled';
export type BookingItemStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface BookingItem {
  readonly id: string;
  readonly componentId?: string;
  readonly description: string;
  readonly supplierId?: string;
  readonly supplierName?: string;
  readonly status: BookingItemStatus;
  readonly confirmationRef?: string;
}

export interface Booking extends TenantScoped {
  readonly id: string;
  readonly enquiryId: string;
  readonly quoteId: string;
  readonly status: BookingStatus;
  readonly items: BookingItem[];
  readonly createdBy: UserId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A supplier purchase order — items for one supplier, derived from a booking. */
export interface SupplierPO {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly bookingId: string;
  readonly items: Array<{ itemId: string; description: string; status: BookingItemStatus }>;
}
