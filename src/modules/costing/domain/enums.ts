/**
 * Costing domain enums (Build guide §3, §5).
 */

export type ComponentType =
  | 'Transport'
  | 'Ticket' // Ticket / Sightseeing
  | 'Meal' // Meal / Restaurant
  | 'Event'
  | 'Guide'
  | 'Hotel'
  | 'EntranceFee'
  | 'Misc';

/** Unit basis a rate is quoted against (Build guide §3 Rate/RateCard). */
export type UnitBasis =
  'per_pax' | 'per_group' | 'per_vehicle' | 'per_night' | 'per_hour' | 'per_km';

/** How a line participates in the headline total (Build guide §5). */
export type Inclusion = 'included' | 'optional';
