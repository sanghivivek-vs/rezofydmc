/**
 * Rate / RateCard (Build guide §3, §5). A priced offering for a component with
 * validity/season, optional child rules, and optional group-size slabs.
 *
 * The child-rule and slab shapes are reused from the Costing module's public
 * types so a catalog Rate maps cleanly onto a costing-engine rate
 * (see service: toCostingRate).
 */

import type { Money } from '@common/money/money';
import type { TenantScoped } from '@common/tenancy/tenant-context';
import type { UnitBasis, ChildRule, GroupSizeSlab } from '@modules/costing';

export interface Rate extends TenantScoped {
  readonly id: string;
  readonly componentId: string;
  readonly unitBasis: UnitBasis;
  readonly net: Money;
  readonly validFrom: string; // ISO YYYY-MM-DD
  readonly validTo: string; // ISO YYYY-MM-DD
  readonly season?: string;
  readonly childRules?: ChildRule[];
  readonly slabs?: GroupSizeSlab[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Unit basis is inherited from the component, so it is not supplied here. */
export interface CreateRateInput {
  readonly componentId: string;
  readonly net: Money;
  readonly validFrom: string;
  readonly validTo: string;
  readonly season?: string;
  readonly childRules?: ChildRule[];
  readonly slabs?: GroupSizeSlab[];
}
