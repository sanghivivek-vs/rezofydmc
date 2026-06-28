/**
 * Component — a sourceable item (Build guide §3 Supply side). Has a type, a
 * supplier, a unit basis, and one or more rates (see rate.ts).
 */

import type { TenantScoped } from '@common/tenancy/tenant-context';
import type { ComponentType, UnitBasis } from '@modules/costing';

export interface Component extends TenantScoped {
  readonly id: string;
  readonly type: ComponentType;
  readonly supplierId: string;
  readonly name: string;
  /** Unit basis all this component's rates are quoted against. */
  readonly unitBasis: UnitBasis;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateComponentInput {
  readonly type: ComponentType;
  readonly supplierId: string;
  readonly name: string;
  readonly unitBasis: UnitBasis;
  readonly notes?: string;
}
