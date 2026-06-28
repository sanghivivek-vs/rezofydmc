/**
 * Supplier / Vendor (Build guide §3 Supply side).
 */

import type { CurrencyCode } from '@common/money/money';
import type { TenantScoped } from '@common/tenancy/tenant-context';
import type { ComponentType } from '@modules/costing';

export interface Supplier extends TenantScoped {
  readonly id: string;
  readonly name: string;
  /** Primary category of what this supplier provides. */
  readonly type?: ComponentType;
  readonly contact?: string;
  readonly currency: CurrencyCode;
  readonly region?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSupplierInput {
  readonly name: string;
  readonly type?: ComponentType;
  readonly contact?: string;
  readonly currency: CurrencyCode;
  readonly region?: string;
}
