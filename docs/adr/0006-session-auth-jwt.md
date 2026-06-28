# ADR 0006 — Session auth: JWT bearer tokens + scrypt passwords

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The Identity & Org module (Build guide §4) needs to authenticate human users of
the DMC platform and carry the tenant identity (org, user, role) into every
request. Build guide §9 requires the auth scheme to be recorded in an ADR.

This is **user/session auth** — distinct from the platform-to-platform
**integration auth** (ADR 0005, decision #1), which remains open and uses signed
webhooks. The two do not share credentials.

## Decision

- **Sessions:** stateless **JWT bearer tokens** (HS256, `@nestjs/jwt`). Claims:
  `sub` (user id), `orgId`, `role`; signed with `JWT_SECRET`, TTL `JWT_TTL`
  (default 12h). `JwtAuthGuard` verifies the token and builds the
  `TenantContext`, replacing the provisional header guard. The
  service/repository tenant-scoping contract (ADR 0004) is unchanged.
- **Passwords:** hashed with Node's built-in **scrypt** (salted, constant-time
  verify) — no native bcrypt dependency. Format `scrypt$N$salt$hash`.
- **Authorization:** role checks at the route boundary via `RolesGuard` +
  `@Roles(...)`; Owner-only data/actions (org settings now; margins later) gated
  server-side, never just in the UI (Build guide §9). The token abstraction
  (`TokenService`) is an interface so the JWT library stays swappable.
- **Bootstrap:** `POST /v1/auth/register-org` creates an org + its first Owner and
  returns a token; `POST /v1/auth/login` mints tokens thereafter.

## Consequences

- Stateless tokens — no session store; revocation before TTL needs a future
  denylist or short TTLs + refresh (defer until required).
- scrypt keeps the dependency surface free of native builds (important given the
  sandbox cannot compile/download some native modules).
- When SSO/OAuth for human users is needed, `TokenService` + `JwtAuthGuard` are
  the seam to extend; record it in a superseding ADR.
