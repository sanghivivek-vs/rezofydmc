# ADR 0007 — Security hardening baseline

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The platform is multi-tenant (200–300 DMC orgs) and handles personal and
commercial data. Build guide §9 already mandates RBAC, central tenant scoping,
owner-only server-side gating, and audit logging — all implemented. Before adding
a browser client and storing production data we need an HTTP-edge and
secret-handling baseline.

## Decision

- **Security headers:** `helmet` applied as middleware on every route
  (`SecurityModule`), so it is active in tests as well as production.
- **Rate limiting:** `@nestjs/throttler` as a global `APP_GUARD` (default 500
  req/min/IP, configurable via `RATE_LIMIT_MAX` / `RATE_LIMIT_TTL_MS`). Credential
  endpoints (`/v1/auth/login`, `/v1/auth/register-org`) carry a tighter
  per-route limit (10/min) to blunt brute-force.
- **CORS:** explicit allowlist via `CORS_ORIGINS` at bootstrap; production must
  set it. Dev reflects the request origin.
- **Fail-closed secrets:** `resolveSecret()` throws in production when a required
  secret (`JWT_SECRET`, `OUTBOUND_WEBHOOK_SECRET`, …) is unset — never a guessable
  default. Non-production warns and uses a clearly-marked dev placeholder.
- **No stack-trace leakage:** the error filter already returns a generic 500 body
  and logs details server-side.

## Follow-ups (tracked, not in this slice)

- Token **refresh + revocation** (jti denylist / short-lived access + refresh
  tokens); current tokens are stateless with a 12h TTL.
- **Dependency scanning (SCA)** + `npm audit` gate in CI.
- **TLS** termination + HSTS preload at the deployment edge.
- Encryption at rest (DB/disk) — see the GDPR slice (ADR 0008).
- Per-tenant webhook secrets (currently one outbound secret).

## Consequences

- Brute-force and header-class attacks are mitigated at the edge without touching
  business logic.
- A production deploy fails fast on missing secrets rather than running insecure.
- Rate limits are configurable so tenants/load can be tuned without code changes.
