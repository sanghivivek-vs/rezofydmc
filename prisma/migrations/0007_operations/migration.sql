-- DMC Platform — operations bookings (Build guide §3 Operations, §10 Phase 2).
-- Additive migration; never edit applied migrations.

CREATE TABLE "booking" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "enquiry_id" TEXT NOT NULL,
    "quote_id"   TEXT NOT NULL,
    "status"     TEXT NOT NULL,
    "items"      JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_org_quote" ON "booking" ("org_id", "quote_id");
CREATE INDEX "booking_org_enquiry" ON "booking" ("org_id", "enquiry_id");
