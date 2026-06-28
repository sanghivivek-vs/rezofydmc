# ADR 0002 — Modular monolith on TypeScript

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Build guide §4 and §9 require a modular monolith with one folder per bounded
context, clear `api → service → repository → domain` layering, and the option to
split into services later only if scale demands it. We must pick a language and
framework and record it (§9, §0).

## Decision

- **Language:** TypeScript (Node ≥ 20), strict mode.
- **Structure:** modular monolith. `src/common/` holds shared core primitives;
  `src/modules/<context>/` holds each bounded context, internally layered
  `api / service / repository / domain`.
- **HTTP / DI framework:** **NestJS** is the chosen direction for the API and
  dependency-injection layer when the first API slice lands — its module system,
  providers, and guards map directly onto our bounded contexts and the
  service-boundary authorization we require.
- **Persistence:** **PostgreSQL** via **Prisma** (migrations + typed client),
  introduced with the first persistence slice. Migrations are versioned and never
  edited once applied (§0, §9).
- **Tests:** **Jest** (+ ts-jest).

### Why the costing engine is framework-agnostic

The Costing & Quotation engine (§5) is the highest-risk module and must be
deterministic and exhaustively unit-tested. It is therefore written as **pure
TypeScript with zero framework or I/O dependencies**, so its tests run instantly
and it can be embedded anywhere. NestJS/Prisma wrap the modules that genuinely
need HTTP, DI, and a database; they do not leak into pure domain logic.

## Consequences

- We get fast, dependency-free tests for the riskiest logic from day one.
- NestJS/Prisma are added incrementally per vertical slice, not up front, keeping
  the dependency surface (and `npm install`) lean until needed.
- If we ever extract a module into its own service, the service interface in each
  module's `index.ts` is the seam to do it along.
