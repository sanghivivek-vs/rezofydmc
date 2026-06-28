import {
  priceQuote,
  priceLine,
  priceSlabTable,
  resolveMarkupPercent,
  resolveFxRate,
} from './costing-engine';
import { money } from '@common/money/money';
import { BusinessRuleError, ValidationError } from '@common/errors/errors';
import type { QuoteInput, CostLineInput, Rate, MarkupRules, FxTable } from '../domain/types';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const fxChfToEur: FxTable = { quoteCurrency: 'EUR', rates: { CHF: 1.05 } };

function perPaxRate(net: number, extra: Partial<Rate> = {}): Rate {
  return {
    rateId: 'r-pax',
    componentId: 'c-pax',
    unitBasis: 'per_pax',
    net: money(net, 'CHF'),
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    ...extra,
  };
}

// --------------------------------------------------------------------------
// Markup precedence
// --------------------------------------------------------------------------

describe('resolveMarkupPercent — precedence component > category > org', () => {
  const rules: MarkupRules = {
    orgDefaultPercent: 10,
    byCategory: { Transport: 20 },
    byComponent: { 'comp-special': 35 },
  };

  it('uses component override first', () => {
    expect(resolveMarkupPercent(rules, 'comp-special', 'Transport')).toBe(35);
  });
  it('falls back to category', () => {
    expect(resolveMarkupPercent(rules, 'comp-x', 'Transport')).toBe(20);
  });
  it('falls back to org default', () => {
    expect(resolveMarkupPercent(rules, 'comp-x', 'Meal')).toBe(10);
  });
  it('treats an explicit 0% as a real override (not falsy fallthrough)', () => {
    const r: MarkupRules = { orgDefaultPercent: 10, byComponent: { free: 0 } };
    expect(resolveMarkupPercent(r, 'free', 'Misc')).toBe(0);
  });
});

describe('resolveFxRate', () => {
  it('returns 1 for the quote currency itself', () => {
    expect(resolveFxRate(fxChfToEur, 'EUR')).toBe(1);
  });
  it('returns the stored rate', () => {
    expect(resolveFxRate(fxChfToEur, 'CHF')).toBe(1.05);
  });
  it('throws when no rate is stored', () => {
    expect(() => resolveFxRate(fxChfToEur, 'USD')).toThrow(BusinessRuleError);
  });
});

// --------------------------------------------------------------------------
// priceLine — unit bases & child rules
// --------------------------------------------------------------------------

describe('priceLine', () => {
  const markup: MarkupRules = { orgDefaultPercent: 20 };
  const pax = { adults: 2, children: [{ age: 5 }, { age: 10 }], infants: 1 };

  it('per_pax applies child rules and charges infants free', () => {
    const line: CostLineInput = {
      lineId: 'L1',
      componentId: 'c-pax',
      componentType: 'Ticket',
      description: 'Jungfraujoch ticket',
      inclusion: 'included',
      travelDate: '2026-07-01',
      rate: perPaxRate(10000, {
        childRules: [
          { minAge: 0, maxAge: 1, chargePercent: 0 },
          { minAge: 2, maxAge: 11, chargePercent: 50 },
        ],
      }),
    };
    const r = priceLine(line, pax, markup, fxChfToEur, 'half-up');
    // 2 adults + 2 children @50% = 3.0 effective pax
    expect(r.chargeableUnits).toBeCloseTo(3.0);
    expect(r.netSource).toEqual(money(30000, 'CHF')); // 10000 * 3.0
    expect(r.fxRate).toBe(1.05);
    expect(r.costQuoteCcy).toEqual(money(31500, 'EUR')); // 30000 * 1.05
    expect(r.sell).toEqual(money(37800, 'EUR')); // *1.20
    expect(r.margin).toEqual(money(6300, 'EUR'));
  });

  it('per_pax with no child rules charges children as adults', () => {
    const line: CostLineInput = {
      lineId: 'L1b',
      componentId: 'c-pax',
      componentType: 'Ticket',
      description: 'no child rules',
      inclusion: 'included',
      travelDate: '2026-07-01',
      rate: perPaxRate(10000),
    };
    const r = priceLine(
      line,
      { adults: 2, children: [{ age: 8 }], infants: 0 },
      markup,
      fxChfToEur,
      'half-up',
    );
    expect(r.chargeableUnits).toBe(3); // 2 + 1 full
    expect(r.netSource).toEqual(money(30000, 'CHF'));
  });

  it('per_group charges once regardless of headcount', () => {
    const line: CostLineInput = {
      lineId: 'L2',
      componentId: 'c-grp',
      componentType: 'Guide',
      description: 'Full-day guide',
      inclusion: 'included',
      travelDate: '2026-07-01',
      rate: {
        rateId: 'r-grp',
        componentId: 'c-grp',
        unitBasis: 'per_group',
        net: money(50000, 'CHF'),
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      },
    };
    const r = priceLine(line, pax, markup, fxChfToEur, 'half-up');
    expect(r.chargeableUnits).toBe(1);
    expect(r.netSource).toEqual(money(50000, 'CHF'));
  });

  it('per_vehicle multiplies by units', () => {
    const line: CostLineInput = {
      lineId: 'L3',
      componentId: 'c-veh',
      componentType: 'Transport',
      description: 'Coach',
      inclusion: 'included',
      travelDate: '2026-07-01',
      units: 2,
      rate: {
        rateId: 'r-veh',
        componentId: 'c-veh',
        unitBasis: 'per_vehicle',
        net: money(20000, 'CHF'),
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      },
    };
    const r = priceLine(line, pax, markup, fxChfToEur, 'half-up');
    expect(r.chargeableUnits).toBe(2);
    expect(r.netSource).toEqual(money(40000, 'CHF'));
  });

  it('throws when a per_night line omits units', () => {
    const line: CostLineInput = {
      lineId: 'L4',
      componentId: 'c-htl',
      componentType: 'Hotel',
      description: 'Room',
      inclusion: 'included',
      travelDate: '2026-07-01',
      rate: {
        rateId: 'r-htl',
        componentId: 'c-htl',
        unitBasis: 'per_night',
        net: money(15000, 'CHF'),
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      },
    };
    expect(() => priceLine(line, pax, markup, fxChfToEur, 'half-up')).toThrow(ValidationError);
  });
});

// --------------------------------------------------------------------------
// priceQuote — full roll-up
// --------------------------------------------------------------------------

describe('priceQuote', () => {
  const input: QuoteInput = {
    pax: { adults: 2, children: [], infants: 0 },
    fx: fxChfToEur,
    markup: { orgDefaultPercent: 10, byCategory: { Transport: 20 } },
    taxes: [{ label: 'VAT', percent: 7.7 }],
    lines: [
      {
        lineId: 'L1',
        componentId: 'c-meal',
        componentType: 'Meal',
        description: 'Dinner',
        inclusion: 'included',
        travelDate: '2026-07-01',
        rate: perPaxRate(10000), // per_pax 10000 CHF
      },
      {
        lineId: 'L2',
        componentId: 'c-coach',
        componentType: 'Transport',
        description: 'Private coach',
        inclusion: 'included',
        travelDate: '2026-07-01',
        rate: {
          rateId: 'r-coach',
          componentId: 'c-coach',
          unitBasis: 'per_group',
          net: money(30000, 'CHF'),
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        },
      },
      {
        lineId: 'L3',
        componentId: 'c-opt',
        componentType: 'Event',
        description: 'Optional lake cruise',
        inclusion: 'optional',
        travelDate: '2026-07-01',
        rate: perPaxRate(5000, { rateId: 'r-opt', componentId: 'c-opt' }),
      },
    ],
  };

  it('rolls up included lines, taxes, total and per-pax', () => {
    const { sell } = priceQuote(input);
    // L1: 10000*2=20000 CHF -> *1.05 = 21000 -> *1.10 = 23100
    // L2: 30000 CHF -> *1.05 = 31500 -> *1.20 = 37800
    expect(sell.includedSubtotal).toEqual(money(60900, 'EUR'));
    expect(sell.taxes).toEqual([{ label: 'VAT', percent: 7.7, amount: money(4689, 'EUR') }]);
    expect(sell.total).toEqual(money(65589, 'EUR'));
    expect(sell.perPax).toEqual(money(32795, 'EUR')); // 65589/2 = 32794.5 -> 32795
  });

  it('prices optional items but excludes them from the headline total', () => {
    const { sell } = priceQuote(input);
    expect(sell.optionalItems).toHaveLength(1);
    // L3: 5000*2=10000 -> *1.05 = 10500 -> *1.10 = 11550
    expect(sell.optionalItems[0]).toEqual({
      lineId: 'L3',
      description: 'Optional lake cruise',
      sell: money(11550, 'EUR'),
    });
    // total unaffected by the optional line
    expect(sell.total).toEqual(money(65589, 'EUR'));
  });

  it('produces an owner-only margin view over included lines (taxes excluded)', () => {
    const { margin } = priceQuote(input);
    expect(margin.totalCost).toEqual(money(52500, 'EUR')); // 21000 + 31500
    expect(margin.totalSell).toEqual(money(60900, 'EUR'));
    expect(margin.totalMargin).toEqual(money(8400, 'EUR'));
    expect(margin.marginPercent).toBeCloseTo((8400 / 60900) * 100, 5);
    expect(margin.lines).toHaveLength(3);
  });

  it('records the FX rate used on each line (never recomputed silently)', () => {
    const { margin } = priceQuote(input);
    for (const line of margin.lines) {
      expect(line.fxRate).toBe(1.05);
    }
  });

  it('rejects an empty quote', () => {
    expect(() => priceQuote({ ...input, lines: [] })).toThrow(ValidationError);
  });

  it('is deterministic: identical inputs -> identical output', () => {
    expect(priceQuote(input)).toEqual(priceQuote(input));
  });

  it('applies tax to optional subtotal only when configured', () => {
    const withOptTax = {
      ...input,
      taxes: [{ label: 'VAT', percent: 10, appliesToOptional: true }],
    };
    const { sell } = priceQuote(withOptTax);
    // base = included 60900 + optional 11550 = 72450; *10% = 7245
    expect(sell.taxes[0].amount).toEqual(money(7245, 'EUR'));
  });
});

// --------------------------------------------------------------------------
// Slab table
// --------------------------------------------------------------------------

describe('priceSlabTable', () => {
  const fxNoop: FxTable = { quoteCurrency: 'CHF', rates: {} };
  const input: QuoteInput = {
    pax: { adults: 1, children: [], infants: 0 },
    fx: fxNoop,
    markup: { orgDefaultPercent: 0 },
    lines: [
      {
        lineId: 'S1',
        componentId: 'c-slab',
        componentType: 'Ticket',
        description: 'Slab-priced sightseeing',
        inclusion: 'included',
        travelDate: '2026-07-01',
        rate: perPaxRate(0, {
          slabs: [
            { minPax: 1, maxPax: 9, net: money(8000, 'CHF') },
            { minPax: 10, maxPax: 15, net: money(6000, 'CHF') },
          ],
        }),
      },
    ],
  };

  it('re-prices per-pax across group sizes', () => {
    const table = priceSlabTable(input, [4, 12]);
    expect(table).toEqual([
      { groupSize: 4, perPax: money(8000, 'CHF'), total: money(32000, 'CHF') },
      { groupSize: 12, perPax: money(6000, 'CHF'), total: money(72000, 'CHF') },
    ]);
  });
});
