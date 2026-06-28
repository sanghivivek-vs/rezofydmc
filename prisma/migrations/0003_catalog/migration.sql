-- DMC Platform — catalog & suppliers tables (Build guide §3, §5).
-- Additive migration; never edit applied migrations.

CREATE TABLE "supplier" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "type"       TEXT,
    "contact"    TEXT,
    "currency"   TEXT NOT NULL,
    "region"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "supplier_org_id" ON "supplier" ("org_id");

CREATE TABLE "component" (
    "id"          TEXT NOT NULL,
    "org_id"      TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "unit_basis"  TEXT NOT NULL,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "component_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "component_org_id" ON "component" ("org_id");
CREATE INDEX "component_org_supplier" ON "component" ("org_id", "supplier_id");

CREATE TABLE "rate" (
    "id"               TEXT NOT NULL,
    "org_id"           TEXT NOT NULL,
    "component_id"     TEXT NOT NULL,
    "unit_basis"       TEXT NOT NULL,
    "net_amount_minor" INTEGER NOT NULL,
    "net_currency"     TEXT NOT NULL,
    "valid_from"       TIMESTAMP(3) NOT NULL,
    "valid_to"         TIMESTAMP(3) NOT NULL,
    "season"           TEXT,
    "child_rules"      JSONB,
    "slabs"            JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rate_org_component" ON "rate" ("org_id", "component_id");
