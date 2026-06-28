-- DMC Platform — notifications (Build guide §4). Derived from the audit stream.
-- Additive migration; never edit applied migrations.

CREATE TABLE "notification" (
    "id"                TEXT NOT NULL,
    "org_id"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "subject_type"      TEXT NOT NULL,
    "subject_id"        TEXT NOT NULL,
    "message"           TEXT NOT NULL,
    "recipient_user_id" TEXT,
    "read"              BOOLEAN NOT NULL DEFAULT false,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_org_created" ON "notification" ("org_id", "created_at");
