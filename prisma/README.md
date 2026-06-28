# Persistence (Prisma + PostgreSQL)

The data model for the platform (ADR 0002, ADR 0004). Money is stored as integer
minor units + ISO currency (ADR 0003); every domain row is `org_id`-scoped and
scoping is applied centrally in the repository (ADR 0004).

## Sandbox limitation

The build sandbox blocks Prisma's engine-binary download at the egress policy
(`binaries.prisma.sh` → `ECONNRESET`). So the **generated Prisma client is not
available here**, and the runtime app + tests use the in-memory repository,
idempotency store, and a logging audit sink. The mapping logic
(`src/modules/enquiry-intake/repository/enquiry.mapper.ts`) and the SQL migration
are real and unit-tested; only the generated client is deferred.

## Wiring it up (DB-enabled environment)

```bash
docker compose up -d                      # local PostgreSQL (docker-compose.yml)
export DATABASE_URL="postgresql://dmc:dmc@localhost:5432/dmc"
npx prisma generate                        # produces @prisma/client
npx prisma migrate deploy                  # applies prisma/migrations/*
npm run typecheck:prisma                   # compile the Prisma layer (optional)
PERSISTENCE=prisma JWT_SECRET=… WEBHOOK_SIGNING_SECRET=… OUTBOUND_WEBHOOK_SECRET=… \
  npm run start:prisma                     # boot on PostgreSQL
```

That is the **entire** swap (ADR 0009): `PERSISTENCE=prisma` selects
`prisma/composition/AppPrismaModule`, which binds the same repository tokens to
the Prisma implementations via the `@Global` `PrismaPersistenceModule`. **No
feature module changes** — they only inject the repository tokens.

CI verifies this path: the `db-integration` job runs Postgres, `prisma generate`,
`prisma migrate deploy`, and `typecheck:prisma`.

## Files

- `schema.prisma` — all models (Enquiry, Organization, User, Supplier, Component,
  Rate, Quote, Itinerary, ConsentRecord, WebhookReceipt, AuditLog).
- `migrations/000N_*/migration.sql` — versioned migrations (never edit an applied
  one; add a new one — Build guide §9).
- `repository/prisma-infra.ts` — Prisma implementations of every repository +
  `PrismaService` + DB audit sink (compiled only when the client is generated).
- `composition/prisma-persistence.module.ts` — `@Global` module binding the repo
  tokens to Prisma.
- `composition/app-prisma.module.ts` — the Prisma application composition.
