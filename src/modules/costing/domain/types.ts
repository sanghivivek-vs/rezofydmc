/**
 * Costing & Quotation domain types (Build guide §3, §5).
 *
 * These are the pure inputs/outputs of the engine. Persistence and API shapes
 * are derived from these but live in their own layers.
 */

import type { Money, CurrencyCode } from '@common/money/money';
import type { ComponentType, UnitBasis, Inclusion } from './enums';

// --------------------------------------------------------------------------
// Demand inputs
// --------------------------------------------------------------------------

export interface ChildPax {
  /** Age in whole years at travel date. */
  readonly age: number;
}

export interface PaxBreakdown {
  readonly adults: number;
  readonly children: ChildPax[];
  readonly infants: number;
}

/** Total headcount including infants. */
export function totalPax(p: PaxBreakdown): number {
  return p.adults + p.children.length + p.infants;
}

/** Chargeable "seats" excluding infants — used for per_pax defaults. */
export function seatedPax(p: PaxBreakdown): number {
  return p.adults + p.children.length;
}

// --------------------------------------------------------------------------
// Rate / RateCard
// --------------------------------------------------------------------------

/**
 * Child pricing rule for per_pax rates. A child whose age falls in
 * [minAge, maxAge] is charged `chargePercent` of the adult net (e.g. 50).
 * Rules are evaluated in order; the first match wins.
 */
export interface ChildRule {
  readonly minAge: number;
  readonly maxAge: number;
  readonly chargePercent: number;
}

/** Group-size slab: net price applies when group size is in [minPax, maxPax]. */
export interface GroupSizeSlab {
  readonly minPax: number;
  /** Inclusive upper bound; use Number.POSITIVE_INFINITY for an open top slab. */
  readonly maxPax: number;
  readonly net: Money;
}

export interface Rate {
  readonly rateId: string;
  readonly componentId: string;
  readonly unitBasis: UnitBasis;
  /** Net cost per unit, in the supplier's currency. */
  readonly net: Money;
  /** Inclusive validity window (ISO-8601 dates, YYYY-MM-DD). */
  readonly validFrom: string;
  readonly validTo: string;
  readonly season?: string;
  /** Optional per_pax child rules. Ignored for non-per_pax bases. */
  readonly childRules?: ChildRule[];
  /**
   * Optional group-size slabs. When present, the slab net REPLACES `net` for the
   * resolved group size. Slabs and `net` share the same unitBasis & currency.
   */
  readonly slabs?: GroupSizeSlab[];
}

// --------------------------------------------------------------------------
// Markup
// --------------------------------------------------------------------------

/**
 * Markup precedence (Build guide §5): component override > category > org default.
 * Percent values, e.g. 20 means +20%.
 */
export interface MarkupRules {
  readonly orgDefaultPercent: number;
  readonly byCategory?: Partial<Record<ComponentType, number>>;
  readonly byComponent?: Record<string, number>;
}

// --------------------------------------------------------------------------
// FX
// --------------------------------------------------------------------------

/**
 * FX rates into the quote currency. `rates[src]` is the multiplier applied to
 * minor units to convert `src` -> quoteCurrency. The rate used per line is
 * recorded on the output (Build guide §5: do not recompute silently).
 */
export interface FxTable {
  readonly quoteCurrency: CurrencyCode;
  readonly rates: Record<CurrencyCode, number>;
}

// --------------------------------------------------------------------------
// Tax / service charges
// --------------------------------------------------------------------------

/**
 * Explicit, configurable tax or service-charge line (Build guide §5: never bake
 * taxes into net rates). Applied to the included-lines sell subtotal.
 */
export interface TaxRule {
  readonly label: string;
  readonly percent: number;
  /** If true the tax also applies to optional items' own subtotal (default false). */
  readonly appliesToOptional?: boolean;
}

// --------------------------------------------------------------------------
// CostLine input — a priced instance of a component inside an itinerary
// --------------------------------------------------------------------------

export interface CostLineInput {
  readonly lineId: string;
  readonly componentId: string;
  readonly componentType: ComponentType;
  readonly description: string;
  readonly rate: Rate;
  readonly inclusion: Inclusion;
  /** ISO-8601 travel date used for validity/season resolution (YYYY-MM-DD). */
  readonly travelDate: string;
  /**
   * Unit count for non-per_pax/per_group bases: number of vehicles / nights /
   * hours / km. Required for those bases; ignored for per_pax & per_group.
   */
  readonly units?: number;
}

// --------------------------------------------------------------------------
// Engine inputs / outputs
// --------------------------------------------------------------------------

export interface QuoteInput {
  readonly pax: PaxBreakdown;
  readonly lines: CostLineInput[];
  readonly markup: MarkupRules;
  readonly fx: FxTable;
  readonly taxes?: TaxRule[];
  readonly rounding?: import('@common/money/money').RoundingMode;
}

export interface PricedLine {
  readonly lineId: string;
  readonly componentId: string;
  readonly componentType: ComponentType;
  readonly description: string;
  readonly inclusion: Inclusion;
  readonly unitBasis: UnitBasis;
  /** Resolved rate id and (if any) the slab/season that applied. */
  readonly rateId: string;
  readonly appliedSeason?: string;
  readonly appliedSlab?: { minPax: number; maxPax: number };
  /** Chargeable quantity in the rate's unit basis after child rules. */
  readonly chargeableUnits: number;
  /** Net cost in the supplier currency. */
  readonly netSource: Money;
  /** FX rate used to reach the quote currency (recorded, not recomputed). */
  readonly fxRate: number;
  /** Net cost in the quote currency. */
  readonly costQuoteCcy: Money;
  readonly markupPercent: number;
  /** Sell price in the quote currency (cost + markup). */
  readonly sell: Money;
  /** sell - cost. */
  readonly margin: Money;
}

export interface TaxLineResult {
  readonly label: string;
  readonly percent: number;
  readonly amount: Money;
}

/** Sell-side view shown to the agency (no cost/margin). */
export interface SellView {
  readonly currency: CurrencyCode;
  readonly includedSubtotal: Money;
  readonly taxes: TaxLineResult[];
  readonly total: Money;
  readonly perPax: Money;
  readonly optionalItems: Array<{
    lineId: string;
    description: string;
    sell: Money;
  }>;
}

/** Internal cost/margin view — OWNER ONLY (gated at service boundary). */
export interface MarginView {
  readonly currency: CurrencyCode;
  readonly totalCost: Money;
  readonly totalSell: Money;
  readonly totalMargin: Money;
  readonly marginPercent: number;
  readonly lines: PricedLine[];
}

export interface QuoteResult {
  readonly sell: SellView;
  readonly margin: MarginView;
}
