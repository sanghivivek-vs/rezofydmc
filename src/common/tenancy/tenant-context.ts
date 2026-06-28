/**
 * Multi-tenancy primitives (Build guide §0, §9).
 *
 * Every domain row is scoped by `org_id` (the DMC). No query may return another
 * tenant's data. Tenant scoping is enforced CENTRALLY — repositories take a
 * {@link TenantContext} and are responsible for applying the `org_id` filter so
 * individual call sites cannot forget it.
 *
 * This file defines the contract; the persistence layer (added with the API
 * slices) wires it into the ORM/query builder.
 */

export type OrgId = string;
export type UserId = string;

export type Role = 'Owner' | 'Sales' | 'Ops' | 'Accounts' | 'ReadOnly';

export interface TenantContext {
  readonly orgId: OrgId;
  readonly userId: UserId;
  readonly role: Role;
  /** Request/trace id for structured logging (Build guide §9 observability). */
  readonly requestId?: string;
}

/** A row that belongs to exactly one tenant. Every domain entity extends this. */
export interface TenantScoped {
  readonly orgId: OrgId;
}

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantViolationError';
  }
}

/**
 * Guard used by repositories/services after loading a row: asserts the row
 * belongs to the active tenant. A failure here means a query escaped scoping —
 * it is a bug, not a user error, and must be loud.
 */
export function assertSameTenant(ctx: TenantContext, row: TenantScoped): void {
  if (row.orgId !== ctx.orgId) {
    throw new TenantViolationError(
      `Cross-tenant access blocked: context org=${ctx.orgId} attempted to touch org=${row.orgId}`,
    );
  }
}

/**
 * Owner-only data (net cost, margins — Build guide §5, §9) is gated at the
 * service boundary, never merely hidden in the UI. Use this to decide whether
 * to attach the internal margin view to a response.
 */
export function canSeeMargins(ctx: TenantContext): boolean {
  return ctx.role === 'Owner';
}
