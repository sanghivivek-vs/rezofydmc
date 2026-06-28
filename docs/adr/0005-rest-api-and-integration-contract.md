# ADR 0005 — REST + versioned, signed integration contract

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Build guide §6 and §9: the DMC and Tour Agency platforms stay decoupled via a
clean, versioned API + webhook contract. We must pick REST or GraphQL (§9), and
define how the two platforms authenticate, stay idempotent, and version payloads.

## Decision

- **API style:** **REST**. Consistent error envelope (`src/common/errors`),
  pagination, and `/v1/…` versioning. Additive-only changes within a version.
- **Integration auth:** service-to-service credentials. **OAuth 2.0
  client-credentials** is the chosen direction (rotatable, scoped) — _to be
  confirmed with the Tour-platform team_ (Build guide §6, §11). Until confirmed,
  schemas are auth-agnostic.
- **Idempotency:** every write/webbook carries an `idempotency_key`; consumers
  dedupe on it. Webhooks are **signed** (HMAC over the raw body) and consumers
  verify before processing.
- **Delivery:** retries with backoff + dead-letter for webhooks; consumers must be
  idempotent.
- **Shared IDs:** `agency_id`, `enquiry_external_id`, `quote_external_id` are
  stable across both platforms.
- **Schemas:** every payload has a JSON Schema in `/docs/integration/`, versioned
  alongside the endpoints.

## Open items (track in §11 "Decisions to confirm")

- Final auth scheme (OAuth client-credentials vs API key).
- Split of responsibility for hotels (agency books hotels vs DMC fills ground
  services only).
- `bookingStatus = TM` precise meaning (Tour-Manager-led, no supplier booking).

## Consequences

- Both teams code against published JSON Schemas, not assumptions.
- Idempotency + signing make the webhook channel safe to retry.
- REST keeps the public surface simple and cache-friendly; if a consumer later
  needs graph-shaped reads we revisit with a new ADR.
