-- DMC Platform — Agency CRM (Build guide §4): agencies, contacts, interactions.
-- Additive migration; never edit applied migrations.

CREATE TABLE "agency" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "type"       TEXT,
    "email"      TEXT,
    "phone"      TEXT,
    "country"    TEXT,
    "website"    TEXT,
    "notes"      TEXT,
    "status"     TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agency_org" ON "agency" ("org_id");

CREATE TABLE "crm_contact" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "agency_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "title"      TEXT,
    "email"      TEXT,
    "phone"      TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_contact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_contact_org_agency" ON "crm_contact" ("org_id", "agency_id");

CREATE TABLE "crm_interaction" (
    "id"          TEXT NOT NULL,
    "org_id"      TEXT NOT NULL,
    "agency_id"   TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "summary"     TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_interaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_interaction_org_agency" ON "crm_interaction" ("org_id", "agency_id");
