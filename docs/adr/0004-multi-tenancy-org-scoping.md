# ADR 0004 — Multi-tenancy via org_id, enforced centrally

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Build guide §0, §9: multi-tenant from line one. Every domain row is scoped by
`org_id` (the DMC); no query may return another tenant's data; scoping is enforced
centrally, not per-query. Owner-only data (net cost, margins) is gated
server-side, never just hidden in the UI.

## Decision

- Every domain entity implements `TenantScoped` (`{ orgId }`) — see
  `src/common/tenancy/tenant-context.ts`.
- Every request carries a `TenantContext` (`orgId`, `userId`, `role`, `requestId`).
- Tenant scoping is applied **centrally in the repository layer**: repositories
  take the `TenantContext` and inject the `org_id` filter so call sites cannot
  forget it. `assertSameTenant()` is a loud backstop for any row that escapes
  scoping (treated as a bug).
- Role-based authorization is checked at the **service boundary**. Margin/cost
  visibility is gated by `canSeeMargins(ctx)` (Owner only); the costing engine
  always computes both views and the service decides what to return.
- Pricing and status mutations emit mandatory `AuditEvent`s
  (`src/common/audit/audit-log.ts`).

## Consequences

- A forgotten `WHERE org_id = ?` cannot leak data, because filtering is not the
  call site's responsibility.
- Owner-only financial data cannot leak through the API even if a UI hides it.
- The DB-backed `AuditSink` and the Prisma scoping middleware are implemented with
  the first persistence slice; the contracts exist now so domain code already
  depends on them.
