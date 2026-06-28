-- DMC Platform — itinerary table (Build guide §3).
-- The itinerary is an aggregate: days + timed segments are stored together.
-- Additive migration; never edit applied migrations.

CREATE TABLE "itinerary" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "enquiry_id" TEXT NOT NULL,
    "version"    INTEGER NOT NULL,
    "title"      TEXT,
    "days"       JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "itinerary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "itinerary_org_enquiry_version"
    ON "itinerary" ("org_id", "enquiry_id", "version");
CREATE INDEX "itinerary_org_enquiry" ON "itinerary" ("org_id", "enquiry_id");
