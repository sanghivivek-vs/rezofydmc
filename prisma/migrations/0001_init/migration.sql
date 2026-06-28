-- DMC Platform — initial migration (Build guide §9: versioned migrations,
-- never edit an applied one). Mirrors prisma/schema.prisma.

-- Enquiry ------------------------------------------------------------------
CREATE TABLE "enquiry" (
    "id"                     TEXT NOT NULL,
    "org_id"                 TEXT NOT NULL,
    "enquiry_external_id"    TEXT,
    "agency_id"              TEXT NOT NULL,
    "source"                 TEXT NOT NULL,
    "destinations"           TEXT[] NOT NULL,
    "date_range"             JSONB,
    "duration_days"          INTEGER,
    "pax"                    JSONB NOT NULL,
    "rooming"                JSONB,
    "hotel_category"         TEXT,
    "named_hotels"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "meal_preference"        TEXT,
    "transport_preference"   JSONB,
    "budget_amount_minor"    INTEGER,
    "budget_currency"        TEXT,
    "must_see_inclusions"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "special_requirements"   TEXT,
    "quote_deadline"         TIMESTAMP(3) NOT NULL,
    "status"                 TEXT NOT NULL,
    "assigned_to_user_id"    TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "enquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enquiry_org_external_id"
    ON "enquiry" ("org_id", "enquiry_external_id");
CREATE INDEX "enquiry_org_status"
    ON "enquiry" ("org_id", "status");

-- Webhook idempotency ------------------------------------------------------
CREATE TABLE "webhook_receipt" (
    "org_id"          TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "enquiry_id"      TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_receipt_pkey" PRIMARY KEY ("org_id", "idempotency_key")
);

-- Audit log ----------------------------------------------------------------
CREATE TABLE "audit_log" (
    "id"           TEXT NOT NULL,
    "org_id"       TEXT NOT NULL,
    "actor_id"     TEXT NOT NULL,
    "action"       TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id"   TEXT NOT NULL,
    "before"       JSONB,
    "after"        JSONB,
    "request_id"   TEXT,
    "at"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_org_action"
    ON "audit_log" ("org_id", "action");
CREATE INDEX "audit_log_org_subject"
    ON "audit_log" ("org_id", "subject_type", "subject_id");
