/**
 * Rate resolution (Build guide §5).
 *
 * Resolves the effective net price for a CostLine by:
 *   component + travel date (validity/season) + applicable group-size slab.
 * Child rules are applied separately during quantity computation in the engine.
 *
 * Pure & deterministic: same inputs -> same output. No clock access.
 */

import type { Money } from '@common/money/money';
import { BusinessRuleError } from '@common/errors/errors';
import type { Rate, GroupSizeSlab } from '../domain/types';

/** Inclusive date-in-range check on ISO YYYY-MM-DD strings (lexicographic works). */
export function isWithinValidity(rate: Rate, travelDate: string): boolean {
  return travelDate >= rate.validFrom && travelDate <= rate.validTo;
}

export interface ResolvedRate {
  readonly net: Money;
  readonly appliedSlab?: { minPax: number; maxPax: number };
  readonly appliedSeason?: string;
}

/**
 * Resolve the net unit price for a rate given the travel date and group size.
 * Throws BusinessRuleError if the rate is not valid for the travel date or no
 * slab covers the group size.
 */
export function resolveRate(rate: Rate, travelDate: string, groupSize: number): ResolvedRate {
  if (!isWithinValidity(rate, travelDate)) {
    throw new BusinessRuleError(
      `Rate ${rate.rateId} is not valid on ${travelDate} (valid ${rate.validFrom}..${rate.validTo})`,
      { rateId: rate.rateId, travelDate },
    );
  }

  if (rate.slabs && rate.slabs.length > 0) {
    const slab = findSlab(rate.slabs, groupSize);
    if (!slab) {
      throw new BusinessRuleError(
        `No group-size slab on rate ${rate.rateId} covers a group of ${groupSize}`,
        { rateId: rate.rateId, groupSize },
      );
    }
    return {
      net: slab.net,
      appliedSlab: { minPax: slab.minPax, maxPax: slab.maxPax },
      appliedSeason: rate.season,
    };
  }

  return { net: rate.net, appliedSeason: rate.season };
}

function findSlab(slabs: GroupSizeSlab[], groupSize: number): GroupSizeSlab | undefined {
  return slabs.find((s) => groupSize >= s.minPax && groupSize <= s.maxPax);
}
