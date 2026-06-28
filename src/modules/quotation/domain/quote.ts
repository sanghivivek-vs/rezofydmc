/**
 * Quote (Build guide §3, §5). A versioned, priced response to an enquiry. Rolls
 * up CostLines via the Costing engine into a sell view (agency) and an owner-only
 * margin view. The margin view is gated server-side (Build guide §9) — see
 * QuotationService.redactForRole.
 */

import type { TenantScoped, UserId } from '@common/tenancy/tenant-context';
import type { CurrencyCode } from '@common/money/money';
import type { SellView, MarginView } from '@modules/costing';

export type QuoteStatus = 'Draft' | 'Sent' | 'Under Revision' | 'Accepted' | 'Rejected' | 'Expired';

export interface Quote extends TenantScoped {
  readonly id: string;
  readonly enquiryId: string;
  readonly version: number;
  readonly status: QuoteStatus;
  readonly currency: CurrencyCode;
  readonly sell: SellView;
  readonly margin: MarginView;
  readonly createdBy: UserId;
  readonly createdAt: string;
}

/** What a caller sees: margin is present only for roles allowed to see it. */
export type QuoteView = Omit<Quote, 'margin'> & { margin?: MarginView };

/** One requested line in a quote (selects a component + travel date). */
export interface QuoteLineSelection {
  readonly componentId: string;
  readonly travelDate: string; // ISO YYYY-MM-DD
  readonly inclusion: 'included' | 'optional';
  /** Units for per_night/per_vehicle/per_hour/per_km rates. */
  readonly units?: number;
  /** Optional human description; defaults to the component name. */
  readonly description?: string;
  /** Per-line markup override (component-level precedence — Build guide §5). */
  readonly markupPercentOverride?: number;
  /** Pin a specific rate; otherwise the rate valid for travelDate is chosen. */
  readonly rateId?: string;
}

export interface CreateQuoteInput {
  readonly enquiryId: string;
  readonly lines: QuoteLineSelection[];
  /** Defaults to the org's default currency. */
  readonly quoteCurrency?: CurrencyCode;
  /** Stored FX rates: sourceCurrency -> multiplier into the quote currency. */
  readonly fxRates?: Record<string, number>;
  readonly taxes?: Array<{ label: string; percent: number; appliesToOptional?: boolean }>;
  readonly rounding?: import('@common/money/money').RoundingMode;
}
