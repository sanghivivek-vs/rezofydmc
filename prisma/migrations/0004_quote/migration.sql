-- DMC Platform — quote table (Build guide §3, §5).
-- Additive migration; never edit applied migrations.

CREATE TABLE "quote" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "enquiry_id" TEXT NOT NULL,
    "version"    INTEGER NOT NULL,
    "status"     TEXT NOT NULL,
    "currency"   TEXT NOT NULL,
    "sell"       JSONB NOT NULL,
    "margin"     JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quote_org_enquiry_version"
    ON "quote" ("org_id", "enquiry_id", "version");
CREATE INDEX "quote_org_enquiry" ON "quote" ("org_id", "enquiry_id");
