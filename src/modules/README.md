# Modules (bounded contexts)

Each folder here is a **bounded context** from the Build guide §4. The platform
is a **modular monolith**: modules live in one repo but stay decoupled.

## Boundary rules (binding — Build guide §0, §4, §9)

1. A module exposes a **service interface** (its `index.ts`). Other modules call
   that interface only.
2. Code in one module **must not** read another module's database tables or reach
   into its internal files. Cross-module data flows through the service interface.
3. Layering inside every module: `api` (controllers/routes) → `service` (business
   logic) → `repository` (data access) → `domain` (entities/types). Business
   logic lives in `service`, never in controllers.

## Modules

| Module                      | Status     | Notes                                                        |
| --------------------------- | ---------- | ----------------------------------------------------------- |
| `costing`                   | ✅ built    | Costing engine — pure, framework-agnostic, fully unit-tested. |
| `quotation`                 | ✅ built    | `/v1/quotes`: composes enquiry + catalog + org defaults, prices via the costing engine, versioned quotes, owner-only margin gated server-side. e2e-tested. |
| `identity-org`              | ✅ built    | Auth (JWT login + org bootstrap, scrypt passwords), users, roles, org settings. `JwtAuthGuard` + `RolesGuard`; Owner-only gates server-side. e2e-tested (ADR 0006). |
| `enquiry-intake`            | ✅ built    | RFQ intake (manual + inbound webhook), triage, status machine, tenant-scoped, audited. NestJS REST API (now JWT-secured) + signed/idempotent webhook + error envelope, e2e-tested. Prisma schema/migration committed; DB-backed repo activates in a DB env (see `prisma/README.md`). |
| `catalog`                   | ✅ built    | Suppliers, components, rate cards (seasons, slabs, child rules). JWT-secured REST, role-gated edits, tenant-scoped. Bridges rates into the costing engine (`listCostingRates`). e2e-tested. |
| agency-crm                  | ⏳ planned  | Counterparty records, contacts.                             |
| itinerary-builder           | ⏳ planned  | Days, timed segments, reference-itinerary fidelity.         |
| documents                   | ⏳ planned  | Itinerary + costing PDF generation, branding.               |
| operations                  | ⏳ phase 2  | Bookings, confirmations, vouchers, payments.                |
| integration                 | ⏳ planned  | API + webhooks to/from the Tour Agency platform (§6).       |
| notifications               | ⏳ planned  | In-app + email events.                                      |
| reporting                   | ⏳ planned  | Pipeline, win/loss, margin by enquiry.                      |

The first vertical slice intentionally builds the **highest-risk** module
(costing) with the most tests, on top of the shared `common/` primitives.
