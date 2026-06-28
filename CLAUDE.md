# CLAUDE.md — working rules for this repository

This project is built from the **DMC Platform — Master Build & Code-Management
Guide**. Sections §0 and §9 of that guide are **binding on every change**. This
file is the short, operational version.

## Golden rules

1. **Small vertical slices.** One coherent feature per branch/PR
   (intake → service → persistence → API → test). No giant PRs.
2. **Plan before code** for any non-trivial task: files to touch, data changes,
   test cases. Then build.
3. **Respect module boundaries.** Code in one module (`src/modules/<ctx>`) must
   not reach into another's tables or internals — only its service interface
   (`index.ts`). See `src/modules/README.md`.
4. **Tests are part of "done."** The costing engine (§5) and the integration
   layer (§6) must have tests before they are complete.
5. **Never edit an applied DB migration.** Add a new one.
6. **Money is never a float.** Integer minor units + ISO currency; all arithmetic
   in minor units. Use `src/common/money`.
7. **Multi-tenant from line one.** Every domain row is scoped by `org_id`;
   scoping enforced centrally (repository), never per-query. No query returns
   another tenant's data.
8. **Ask, don't assume** on: pricing rules, tax handling, cancellation policy,
   and anything in `docs/decisions-to-confirm.md`.
9. **Document decisions.** Any architectural choice gets an ADR in `docs/adr/`.
   Integration payloads get a JSON Schema in `docs/integration/`.

## Layering (inside each module)

`api` (controllers/routes) → `service` (business logic) → `repository` (data
access) → `domain` (entities/types). Business logic lives in `service`, never in
controllers. Owner-only data (margins, net cost) is gated **server-side** at the
service boundary (`canSeeMargins`), never just hidden in the UI.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`).
- **Branches:** trunk-based, short-lived, one feature per PR.
- **CI must pass before merge** (format, lint, typecheck, test).
- **Time** stored in UTC; displayed in trip-local time.
- **Feature-flag** anything not ready for all tenants.
- **Logging** is structured with `org_id` + request id.

## Commands

```bash
npm test          # jest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run format    # prettier --write
```

## Current state

Foundation + Costing engine are built and tested. The next slices (Identity/Org,
Enquiry intake, Itinerary builder, Catalog, Integration layer) are listed in
`src/modules/README.md`. Add NestJS + Prisma with the first API/persistence slice
(ADR 0002); keep the costing engine framework-agnostic.
