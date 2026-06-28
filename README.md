# DMC Platform

A platform for **Destination Management Companies** (DMCs) to receive agency
requirements, build day-by-day itineraries, source and price ground components,
send quotes, and manage operations. It integrates with the Rezofy Tour Agency
platform via a decoupled, versioned API + webhook contract.

This repository is built from the **DMC Platform — Master Build & Code-Management
Guide**. That guide's engineering conventions (§0, §9) are binding on every
change; see [`CLAUDE.md`](./CLAUDE.md) for the working rules.

## Status

First vertical slice: **foundation + Costing & Quotation engine**.

- ✅ Shared core primitives — `Money` (integer minor units), multi-tenancy,
  errors, audit contract (`src/common/`).
- ✅ **Costing & Quotation engine** — the highest-risk module (§5), built as pure,
  deterministic TypeScript with comprehensive unit tests (`src/modules/costing/`).
- ✅ ADRs (`docs/adr/`), integration JSON Schemas (`docs/integration/`), CI.
- ⏳ Identity/Org, Enquiry intake, Itinerary builder, Catalog, Documents,
  Integration layer, etc. — see [`src/modules/README.md`](./src/modules/README.md).

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
npm test          # jest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run format    # prettier --write
```

Requires Node ≥ 20.

## Decisions still open

See [`docs/decisions-to-confirm.md`](docs/decisions-to-confirm.md) — items the
Build guide says to confirm with the business before hard-coding (tax values,
cancellation policy, auth scheme, hotel responsibility split, etc.).
