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
export DATABASE_URL="postgresql://user:pass@localhost:5432/dmc"
npx prisma generate          # produces @prisma/client
npx prisma migrate deploy     # applies prisma/migrations/*
```

Then swap the in-memory providers in
`src/modules/enquiry-intake/enquiry.module.ts` for the Prisma-backed ones in
`prisma/repository/prisma-infra.ts`:

```ts
import {
  PrismaService,
  PrismaEnquiryRepository,
  PrismaIdempotencyStore,
  PrismaAuditSink,
} from '../../../prisma/repository/prisma-infra';

providers: [
  PrismaService,
  { provide: ENQUIRY_REPOSITORY, useClass: PrismaEnquiryRepository },
  { provide: IDEMPOTENCY_STORE, useClass: PrismaIdempotencyStore },
  { provide: AUDIT_SINK, useClass: PrismaAuditSink },
  // ...EnquiryService factory unchanged
]
```

The `EnquiryService` and controllers do not change — that is the point of the
repository seam.

## Files

- `schema.prisma` — models: `Enquiry`, `WebhookReceipt`, `AuditLog`.
- `migrations/0001_init/migration.sql` — initial schema (never edit once applied;
  add a new migration instead — Build guide §9).
- `repository/prisma-infra.ts` — Prisma implementations of the repository,
  idempotency store, and audit sink (compiled only when the client is generated).
