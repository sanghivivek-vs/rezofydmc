-- DMC Platform — GDPR consent records (ADR 0008).
-- Erasure/anonymisation operate in place on existing tables, so no schema change
-- is needed for them; only the consent ledger is new.
-- Additive migration; never edit applied migrations.

CREATE TABLE "consent_record" (
    "id"           TEXT NOT NULL,
    "org_id"       TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_ref"  TEXT NOT NULL,
    "purpose"      TEXT NOT NULL,
    "lawful_basis" TEXT NOT NULL,
    "granted"      BOOLEAN NOT NULL,
    "recorded_by"  TEXT NOT NULL,
    "recorded_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consent_record_org_subject" ON "consent_record" ("org_id", "subject_ref");
