/**
 * Costing & Quotation engine (Build guide §5) — the highest-risk module.
 *
 * Responsibilities:
 *   1. Resolve each CostLine's rate by component + travel date + group-size slab.
 *   2. Compute chargeable quantity per unit basis, applying child rules for per_pax.
 *   3. Convert each net cost to the quote currency via a STORED FX rate (recorded).
 *   4. Apply markup with precedence: component > category > org default.
 *   5. Roll up into per-pax and total views; separate included vs optional lines.
 *   6. Add explicit tax / service-charge lines (never baked into net rates).
 *   7. Emit a sell-side view (agency) and an internal cost/margin view (owner-only).
 *
 * Guarantees: PURE and DETERMINISTIC. No clock, no randomness, no I/O.
 * Given identical inputs it produces byte-identical output.
 */

import {
  add,
  multiply,
  scale,
  convert,
  sum,
  zero,
  roundMinor,
  subtract,
  type Money,
  type RoundingMode,
} from '@common/money/money';
import { BusinessRuleError, ValidationError } from '@common/errors/errors';
import type {
  QuoteInput,
  QuoteResult,
  PricedLine,
  CostLineInput,
  MarkupRules,
  FxTable,
  PaxBreakdown,
  ChildRule,
  TaxRule,
  TaxLineResult,
  SellView,
  MarginView,
} from '../domain/types';
import { totalPax } from '../domain/types';
import type { ComponentType, UnitBasis } from '../domain/enums';
import { resolveRate } from './rate-resolver';

const HUNDRED = 100;

/** Resolve the markup percent for a line using the documented precedence. */
export function resolveMarkupPercent(
  rules: MarkupRules,
  componentId: string,
  componentType: ComponentType,
): number {
  const byComponent = rules.byComponent?.[componentId];
  if (byComponent !== undefined) return byComponent;

  const byCategory = rules.byCategory?.[componentType];
  if (byCategory !== undefined) return byCategory;

  return rules.orgDefaultPercent;
}

/** Look up the stored FX rate for a source currency into the quote currency. */
export function resolveFxRate(fx: FxTable, sourceCurrency: string): number {
  if (sourceCurrency === fx.quoteCurrency) return 1;
  const rate = fx.rates[sourceCurrency];
  if (rate === undefined) {
    throw new BusinessRuleError(`No FX rate stored for ${sourceCurrency} -> ${fx.quoteCurrency}`, {
      sourceCurrency,
      quoteCurrency: fx.quoteCurrency,
    });
  }
  return rate;
}

/**
 * Compute the net cost (in the SUPPLIER currency) for a single resolved line.
 * Returns the cost and the chargeable units in the rate's basis.
 */
function computeLineNet(
  line: CostLineInput,
  unitNet: Money,
  unitBasis: UnitBasis,
  pax: PaxBreakdown,
  rounding: RoundingMode,
): { net: Money; chargeableUnits: number } {
  switch (unitBasis) {
    case 'per_pax':
      return computePerPaxNet(line, unitNet, pax, rounding);
    case 'per_group':
      // Whole-group rate: charged once regardless of headcount.
      return { net: unitNet, chargeableUnits: 1 };
    case 'per_vehicle':
    case 'per_night':
    case 'per_hour':
    case 'per_km': {
      const units = requireUnits(line, unitBasis);
      return { net: multiply(unitNet, units), chargeableUnits: units };
    }
    default: {
      const _exhaustive: never = unitBasis;
      throw new ValidationError(`Unsupported unit basis: ${String(_exhaustive)}`);
    }
  }
}

function requireUnits(line: CostLineInput, basis: UnitBasis): number {
  if (line.units === undefined) {
    throw new ValidationError(`Line ${line.lineId} (${basis}) requires "units"`, {
      lineId: line.lineId,
      basis,
    });
  }
  if (!Number.isInteger(line.units) || line.units < 0) {
    throw new ValidationError(`Line ${line.lineId} "units" must be a non-negative integer`, {
      lineId: line.lineId,
      units: line.units,
    });
  }
  return line.units;
}

/**
 * per_pax: adults charged at 100%, children charged per the first matching child
 * rule (default 100% if none match), infants free (0%) by default. The result is
 * a whole-money amount; we accumulate fractional child charges in minor units and
 * round once at the end so per-pax pricing stays deterministic.
 *
 * `chargeableUnits` is returned as the effective pax-equivalent (a real number)
 * for transparency on the line.
 */
function computePerPaxNet(
  line: CostLineInput,
  unitNet: Money,
  pax: PaxBreakdown,
  rounding: RoundingMode,
): { net: Money; chargeableUnits: number } {
  let effectivePax = pax.adults; // adults at 100%
  for (const child of pax.children) {
    effectivePax += childChargeFraction(line.rate.childRules, child.age);
  }
  // infants: free by default (0%). A childRule covering their age can charge them
  // if the business chooses — handled by including them as children upstream.

  const netMinor = roundMinor(unitNet.amountMinor * effectivePax, rounding);
  return {
    net: { amountMinor: netMinor, currency: unitNet.currency },
    chargeableUnits: effectivePax,
  };
}

function childChargeFraction(rules: ChildRule[] | undefined, age: number): number {
  if (!rules || rules.length === 0) {
    return 1; // no rules -> child charged as adult
  }
  const match = rules.find((r) => age >= r.minAge && age <= r.maxAge);
  if (!match) {
    return 1; // outside all rules -> full charge
  }
  return match.chargePercent / HUNDRED;
}

/** Price a single cost line end-to-end. */
export function priceLine(
  line: CostLineInput,
  pax: PaxBreakdown,
  markup: MarkupRules,
  fx: FxTable,
  rounding: RoundingMode,
): PricedLine {
  const groupSize = totalPax(pax);
  const resolved = resolveRate(line.rate, line.travelDate, groupSize);

  const { net: netSource, chargeableUnits } = computeLineNet(
    line,
    resolved.net,
    line.rate.unitBasis,
    pax,
    rounding,
  );

  const fxRate = resolveFxRate(fx, netSource.currency);
  const costQuoteCcy = convert(netSource, fx.quoteCurrency, fxRate, rounding);

  const markupPercent = resolveMarkupPercent(markup, line.componentId, line.componentType);
  const sell = scale(costQuoteCcy, 1 + markupPercent / HUNDRED, rounding);
  const margin = subtract(sell, costQuoteCcy);

  return {
    lineId: line.lineId,
    componentId: line.componentId,
    componentType: line.componentType,
    description: line.description,
    inclusion: line.inclusion,
    unitBasis: line.rate.unitBasis,
    rateId: line.rate.rateId,
    appliedSeason: resolved.appliedSeason,
    appliedSlab: resolved.appliedSlab,
    chargeableUnits,
    netSource,
    fxRate,
    costQuoteCcy,
    markupPercent,
    sell,
    margin,
  };
}

function computeTaxes(
  rules: TaxRule[] | undefined,
  includedSellSubtotal: Money,
  optionalSellSubtotal: Money,
  rounding: RoundingMode,
): TaxLineResult[] {
  if (!rules || rules.length === 0) return [];
  return rules.map((rule) => {
    let base = includedSellSubtotal;
    if (rule.appliesToOptional) {
      base = add(includedSellSubtotal, optionalSellSubtotal);
    }
    const amount = scale(base, rule.percent / HUNDRED, rounding);
    return { label: rule.label, percent: rule.percent, amount };
  });
}

/**
 * Price a whole quote: roll up all lines into a sell view and an owner-only
 * margin view.
 */
export function priceQuote(input: QuoteInput): QuoteResult {
  const rounding: RoundingMode = input.rounding ?? 'half-up';
  const quoteCcy = input.fx.quoteCurrency;

  if (input.lines.length === 0) {
    throw new ValidationError('A quote must contain at least one cost line');
  }

  const priced: PricedLine[] = input.lines.map((line) =>
    priceLine(line, input.pax, input.markup, input.fx, rounding),
  );

  const includedLines = priced.filter((l) => l.inclusion === 'included');
  const optionalLines = priced.filter((l) => l.inclusion === 'optional');

  const includedSubtotal = sum(
    includedLines.map((l) => l.sell),
    quoteCcy,
  );
  const optionalSubtotal = sum(
    optionalLines.map((l) => l.sell),
    quoteCcy,
  );

  const taxes = computeTaxes(input.taxes, includedSubtotal, optionalSubtotal, rounding);
  const taxTotal = sum(
    taxes.map((t) => t.amount),
    quoteCcy,
  );

  const total = add(includedSubtotal, taxTotal);

  const headcount = totalPax(input.pax);
  const perPax: Money =
    headcount > 0
      ? { amountMinor: roundMinor(total.amountMinor / headcount, rounding), currency: quoteCcy }
      : zero(quoteCcy);

  const sell: SellView = {
    currency: quoteCcy,
    includedSubtotal,
    taxes,
    total,
    perPax,
    optionalItems: optionalLines.map((l) => ({
      lineId: l.lineId,
      description: l.description,
      sell: l.sell,
    })),
  };

  // Internal margin view covers INCLUDED lines (the headline deal). Taxes are
  // pass-through and excluded from margin.
  const totalCost = sum(
    includedLines.map((l) => l.costQuoteCcy),
    quoteCcy,
  );
  const totalSell = includedSubtotal;
  const totalMargin = subtract(totalSell, totalCost);
  const marginPercent =
    totalSell.amountMinor === 0 ? 0 : (totalMargin.amountMinor / totalSell.amountMinor) * HUNDRED;

  const margin: MarginView = {
    currency: quoteCcy,
    totalCost,
    totalSell,
    totalMargin,
    marginPercent,
    lines: priced,
  };

  return { sell, margin };
}

/**
 * Group-size slab table (Build guide §5): re-price the same quote across several
 * group sizes so the agency sees how per-pax cost changes with headcount. Each
 * entry overrides only the adult count; children/infants are held constant.
 */
export function priceSlabTable(
  input: QuoteInput,
  groupSizes: number[],
): Array<{ groupSize: number; perPax: Money; total: Money }> {
  return groupSizes.map((groupSize) => {
    const adults = groupSize - input.pax.children.length - input.pax.infants;
    if (adults < 0) {
      throw new ValidationError(
        `Group size ${groupSize} is smaller than the fixed children+infants count`,
        { groupSize },
      );
    }
    const variant: QuoteInput = {
      ...input,
      pax: { ...input.pax, adults },
    };
    const result = priceQuote(variant);
    return { groupSize, perPax: result.sell.perPax, total: result.sell.total };
  });
}
