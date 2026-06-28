/**
 * Itinerary domain enums (Build guide §3 Itinerary).
 */

export type SegmentType =
  | 'Transfer'
  | 'CheckIn'
  | 'Sightseeing'
  | 'Excursion'
  | 'Meal'
  | 'Event'
  | 'FreeTime'
  | 'Guide'
  | 'Cruise'
  | 'Shopping';

export const SEGMENT_TYPES: readonly SegmentType[] = [
  'Transfer',
  'CheckIn',
  'Sightseeing',
  'Excursion',
  'Meal',
  'Event',
  'FreeTime',
  'Guide',
  'Cruise',
  'Shopping',
];
