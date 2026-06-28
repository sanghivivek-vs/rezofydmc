# DMC Platform

A platform for **Destination Management Companies** (DMCs) to receive agency
requirements, build day-by-day itineraries, source and price ground components,
send quotes, and manage operations. It integrates with the Rezofy Tour Agency
platform via a decoupled, versioned API + webhook contract.

This repository is built from the **DMC Platform — Master Build & Code-Management
Guide**. That guide's engineering conventions (§0, §9) are binding on every
change; see [`CLAUDE.md`](./CLAUDE.md) for the working rules.

## Status

Built so far (Phase 1):

- ✅ Shared core primitives — `Money` (integer minor units), multi-tenancy,
  errors, audit, clock, ids (`src/common/`).
- ✅ **Costing & Quotation engine** — the highest-risk module (§5), built as pure,
  deterministic TypeScript with comprehensive unit tests (`src/modules/costing/`).
- ✅ **Enquiry Intake** — manual + inbound-webhook RFQ intake, status state
  machine, triage, tenant-scoped repository, audited mutations
  (`src/modules/enquiry-intake/`).
- ✅ **Identity & Org** — JWT login + org bootstrap (scrypt password hashing),
  users, roles, org settings; `JwtAuthGuard` + `RolesGuard` with Owner-only gates
  enforced server-side (`src/modules/identity-org/`, ADR 0006).
- ✅ **Catalog & Suppliers** — suppliers, components, and rate cards (seasons,
  group-size slabs, child rules), tenant-scoped with role-gated edits; bridges
  rates into the costing engine (`src/modules/catalog/`).
- ✅ **Itinerary Builder** — versioned itineraries with days and timed segments
  (type, supplier, booking status validated against the org's configurable set,
  optional catalog-component link); segment status changes are audited
  (`src/modules/itinerary/`).
- ✅ **Quotation** — `POST /v1/quotes` composes an enquiry's pax, the org's
  costing defaults, and catalog rates, prices them through the costing engine,
  and persists a versioned quote. The sell view is returned to everyone; the
  **owner-only margin view is gated server-side** (`src/modules/quotation/`).
  This closes the Phase-1 core loop: enquiry → catalog → priced quote.
- ✅ **Documents** — `GET /v1/quotes/:id/document` (client quote + itinerary,
  sell-side) and `GET /v1/quotes/:id/costing-sheet` (Owner-only cost/margin), via
  a `DocumentRenderer` port — HTML now, a PDF engine swappable behind the same
  port (`src/modules/documents/`).
- ✅ **Integration (outbound)** — `POST /v1/quotes/:id/send` emits a signed
  `quote.sent`; segment status changes emit `segment.status.updated`. The
  dispatcher signs (HMAC), retries with backoff, and dead-letters on exhaustion
  (`src/modules/integration/`, ADR 0005). Only the sell-side view is shared.
- ✅ **HTTP/API layer (NestJS)** — versioned REST (`/v1/auth`, `/v1/org`,
  `/v1/users`, `/v1/enquiries`, `/v1/suppliers`, `/v1/components`, `/v1/quotes`
  (+ `/send`), `/v1/itineraries`), JWT-secured, an HMAC-signed + idempotent
  inbound webhook, consistent error envelope, all e2e-tested.
- ✅ **Persistence (Prisma + PostgreSQL)** — schema + initial migration + tested
  row↔domain mapper. The generated Prisma client can't be produced in the build
  sandbox (egress policy blocks the engine download), so the running app/tests use
  an in-memory repository; the DB-backed repo activates in a DB env — see
  [`prisma/README.md`](./prisma/README.md).
- ✅ ADRs (`docs/adr/`), integration JSON Schemas (`docs/integration/`), CI.

**Phase 1 (MVP) is functionally complete** — the full core loop runs end-to-end:
receive an enquiry → build a Switzerland-style itinerary → price it from the
catalog → generate the quote document → send the quote (`quote.sent`). Next is
**Phase 2** (Operations: bookings/confirmations/vouchers, the revision loop,
notifications, reporting) — see [`src/modules/README.md`](./src/modules/README.md).

## Architecture

Modular monolith in TypeScript (ADR 0002). One folder per bounded context under
`src/modules/`; shared code in `src/common/`. Layering inside each module:
`api → service → repository → domain`. Modules talk to each other only through
each module's service interface (`index.ts`), never across database tables.

Key decisions are recorded as ADRs:

- [0002 — Modular monolith on TypeScript](docs/adr/0002-modular-monolith-and-stack.md)
- [0003 — Money as integer minor units](docs/adr/0003-money-as-integer-minor-units.md)
- [0004 — Multi-tenancy via org_id](docs/adr/0004-multi-tenancy-org-scoping.md)
- [0005 — REST + versioned integration contract](docs/adr/0005-rest-api-and-integration-contract.md)
- [0006 — Session auth: JWT + scrypt](docs/adr/0006-session-auth-jwt.md)
- [0007 — Security hardening baseline](docs/adr/0007-security-hardening.md)
- [0008 — GDPR technical controls](docs/adr/0008-gdpr-technical-controls.md)
- [0009 — Env-swappable persistence (in-memory ⇄ PostgreSQL)](docs/adr/0009-postgresql-persistence-activation.md)

## The costing engine (§5)

Given the same inputs it produces identical output. It:

1. Resolves each cost line's rate by component + travel date (season) +
   group-size slab.
2. Computes chargeable quantity per unit basis, applying child rules for `per_pax`.
3. Converts to the quote currency using a **stored** FX rate (recorded per line).
4. Applies markup with precedence: **component > category > org default**.
5. Rolls up per-pax and total views; separates **included** vs **optional** items.
6. Adds **explicit** tax / service-charge lines (never baked into net rates).
7. Emits a **sell-side** view (agency) and an **owner-only** cost/margin view.

```ts
import { priceQuote } from './src/modules/costing';

const result = priceQuote({
  pax: { adults: 2, children: [{ age: 8 }], infants: 0 },
  fx: { quoteCurrency: 'EUR', rates: { CHF: 1.05 } },
  markup: { orgDefaultPercent: 15, byCategory: { Transport: 20 } },
  taxes: [{ label: 'VAT', percent: 7.7 }],
  lines: [/* CostLineInput[] */],
});
result.sell;   // shown to the agency
result.margin; // OWNER ONLY — gated at the service boundary
```

## Development

```bash
npm install
npm test          # jest (unit + e2e)
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run format    # prettier --write
npm run start:dev # boot the API (in-memory persistence) on :3000
```

Requires Node ≥ 20.

### Frontend (web/)

The internal operations console is a React + Vite + TypeScript SPA (Tailwind) in
[`web/`](./web) — a separate package that consumes this API. Multi-tenancy and
the owner-only margin gate stay server-side; the SPA is a thin rendering layer.

```bash
cd web && npm install
npm run dev    # Vite on :5173, proxies /v1 -> the API on :3000
npm test       # vitest
npm run build  # production build -> web/dist
```

### Running the API

```bash
WEBHOOK_SIGNING_SECRET=dev-secret JWT_SECRET=dev-jwt npm run start:dev

# 1) bootstrap an org + owner, capture the token
TOKEN=$(curl -s -X POST localhost:3000/v1/auth/register-org \
  -H 'content-type: application/json' \
  -d '{"org":{"name":"Alpine DMC","defaultCurrency":"CHF"},
       "owner":{"email":"owner@alpine.test","name":"Owner","password":"password123"}}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 2) call a protected endpoint with the bearer token
curl -X POST localhost:3000/v1/enquiries \
  -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"agencyId":"AG1","destinations":["Switzerland"],
       "pax":{"adults":2,"children":[],"infants":0},
       "quoteDeadline":"2026-06-15T00:00:00Z"}'
```

The inbound webhook (`POST /v1/integration/webhooks/enquiry`) is authenticated
separately by an `x-signature` HMAC-SHA256 of the raw body keyed by
`WEBHOOK_SIGNING_SECRET`, plus `x-org-id` (ADR 0005) — not by a user token. To use
PostgreSQL instead of the in-memory store, see [`prisma/README.md`](./prisma/README.md).

## Decisions still open

See [`docs/decisions-to-confirm.md`](docs/decisions-to-confirm.md) — items the
Build guide says to confirm with the business before hard-coding (tax values,
cancellation policy, auth scheme, hotel responsibility split, etc.).
