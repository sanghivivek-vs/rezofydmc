# ADR 0009 — Env-swappable persistence (in-memory ⇄ PostgreSQL/Prisma)

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Persistence had to be real (PostgreSQL via Prisma — ADR 0002) but the build
sandbox blocks Prisma's engine-binary download and has no database, so the DB
path cannot run here. We need a clean way to develop/test on an in-memory backend
yet deploy on PostgreSQL **without changing feature modules**, and to verify the
DB path in CI.

## Decision

- **One repository contract, two backends.** Every domain repository + the
  idempotency and consent stores are bound in a single `@Global` persistence
  module. Feature modules only inject the tokens; they never bind them.
  - Default: `src/app/persistence/InMemoryPersistenceModule` (sandbox/tests/dev).
  - DB env: `prisma/composition/PrismaPersistenceModule` (one shared
    `PrismaService`, Prisma repos in `prisma/repository/prisma-infra.ts`).
- **Shared feature list.** `src/app/feature-modules.ts` is imported by both the
  default `AppModule` and `prisma/composition/AppPrismaModule`, so swapping
  persistence cannot drift the feature wiring.
- **Runtime selection** via `PERSISTENCE=prisma` in `main.ts` (a runtime
  `require` of the Prisma composition, so the default build never depends on the
  generated client).
- **Separate compilation.** The Prisma layer (which imports `@prisma/client`)
  lives outside the default `tsconfig` and is compiled via `tsconfig.prisma.json`
  after `prisma generate`.
- **CI proof.** A `db-integration` job spins a PostgreSQL service, runs
  `prisma generate` + `prisma migrate deploy`, then `typecheck:prisma` — verifying
  the Prisma repos compile against the real generated client and the migrations
  apply. The default `build-test` job keeps running the full suite on in-memory.

## Activating PostgreSQL

```bash
docker compose up -d
export DATABASE_URL=postgresql://dmc:dmc@localhost:5432/dmc
npx prisma generate && npx prisma migrate deploy
PERSISTENCE=prisma JWT_SECRET=… WEBHOOK_SIGNING_SECRET=… OUTBOUND_WEBHOOK_SECRET=… \
  npm run start:prisma
```

## Consequences

- The in-memory path stays the fast, dependency-free default for tests/sandbox.
- A DB deployment is a config flag, not a code change.
- The Prisma path is type-checked + migrated in CI, so it does not rot even
  though the sandbox can't run it. Running the full e2e suite against PostgreSQL
  is a straightforward follow-up in a DB-enabled runner.
