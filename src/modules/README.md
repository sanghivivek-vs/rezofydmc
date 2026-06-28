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
| `costing`                   | ✅ built    | Costing & Quotation engine — pure, fully unit-tested.       |
| `enquiry-intake`            | ✅ built\*  | RFQ intake (manual + inbound webhook), triage, status machine, tenant-scoped, audited. \*Persistence/HTTP (Prisma + NestJS) is the next slice. |
| identity-org                | ⏳ planned  | Auth, users, roles, tenancy, org settings.                  |
| agency-crm                  | ⏳ planned  | Counterparty records, contacts.                             |
| itinerary-builder           | ⏳ planned  | Days, timed segments, reference-itinerary fidelity.         |
| catalog-suppliers           | ⏳ planned  | Components, suppliers, rate cards, seasons, slabs.          |
| documents                   | ⏳ planned  | Itinerary + costing PDF generation, branding.               |
| operations                  | ⏳ phase 2  | Bookings, confirmations, vouchers, payments.                |
| integration                 | ⏳ planned  | API + webhooks to/from the Tour Agency platform (§6).       |
| notifications               | ⏳ planned  | In-app + email events.                                      |
| reporting                   | ⏳ planned  | Pipeline, win/loss, margin by enquiry.                      |

The first vertical slice intentionally builds the **highest-risk** module
(costing) with the most tests, on top of the shared `common/` primitives.
