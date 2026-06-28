/**
 * Enquiry domain enums (Build guide §3).
 */

export type EnquiryStatus =
  'New' | 'In Progress' | 'Quoted' | 'Revision Requested' | 'Won' | 'Lost' | 'Expired';

export const ENQUIRY_STATUSES: readonly EnquiryStatus[] = [
  'New',
  'In Progress',
  'Quoted',
  'Revision Requested',
  'Won',
  'Lost',
  'Expired',
];

export type TransportMode = 'SIC' | 'private';

/** How the enquiry entered the system. */
export type EnquirySource = 'manual' | 'integration';
