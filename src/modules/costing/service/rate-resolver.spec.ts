import { resolveRate, isWithinValidity } from './rate-resolver';
import { BusinessRuleError } from '@common/errors/errors';
import { money } from '@common/money/money';
import type { Rate } from '../domain/types';

const baseRate: Rate = {
  rateId: 'r1',
  componentId: 'c1',
  unitBasis: 'per_pax',
  net: money(5000, 'CHF'),
  validFrom: '2026-06-01',
  validTo: '2026-09-30',
  season: 'Summer',
};

describe('rate-resolver', () => {
  describe('validity', () => {
    it('accepts a date inside the window (inclusive bounds)', () => {
      expect(isWithinValidity(baseRate, '2026-06-01')).toBe(true);
      expect(isWithinValidity(baseRate, '2026-09-30')).toBe(true);
      expect(isWithinValidity(baseRate, '2026-07-15')).toBe(true);
    });

    it('rejects a date outside the window', () => {
      expect(isWithinValidity(baseRate, '2026-05-31')).toBe(false);
      expect(isWithinValidity(baseRate, '2026-10-01')).toBe(false);
    });

    it('throws when resolving outside validity', () => {
      expect(() => resolveRate(baseRate, '2026-01-01', 4)).toThrow(BusinessRuleError);
    });
  });

  describe('group-size slabs', () => {
    const slabbed: Rate = {
      ...baseRate,
      net: money(0, 'CHF'),
      slabs: [
        { minPax: 1, maxPax: 9, net: money(8000, 'CHF') },
        { minPax: 10, maxPax: 15, net: money(6000, 'CHF') },
        { minPax: 16, maxPax: Number.POSITIVE_INFINITY, net: money(5000, 'CHF') },
      ],
    };

    it('selects the slab covering the group size', () => {
      expect(resolveRate(slabbed, '2026-07-01', 4).net).toEqual(money(8000, 'CHF'));
      expect(resolveRate(slabbed, '2026-07-01', 12).net).toEqual(money(6000, 'CHF'));
      expect(resolveRate(slabbed, '2026-07-01', 30).net).toEqual(money(5000, 'CHF'));
    });

    it('records which slab applied', () => {
      expect(resolveRate(slabbed, '2026-07-01', 12).appliedSlab).toEqual({
        minPax: 10,
        maxPax: 15,
      });
    });

    it('throws when no slab covers the group size', () => {
      const gapped: Rate = {
        ...baseRate,
        slabs: [{ minPax: 10, maxPax: 15, net: money(6000, 'CHF') }],
      };
      expect(() => resolveRate(gapped, '2026-07-01', 4)).toThrow(/No group-size slab/);
    });
  });

  it('returns the flat net when no slabs are present', () => {
    const r = resolveRate(baseRate, '2026-07-01', 4);
    expect(r.net).toEqual(money(5000, 'CHF'));
    expect(r.appliedSlab).toBeUndefined();
    expect(r.appliedSeason).toBe('Summer');
  });
});
