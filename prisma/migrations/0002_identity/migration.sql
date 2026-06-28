-- DMC Platform — identity & org tables (Build guide §3, §4; ADR 0006).
-- Additive migration; never edit 0001 once applied.

CREATE TABLE "organization" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "settings"   JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_user" (
    "id"            TEXT NOT NULL,
    "org_id"        TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "role"          TEXT NOT NULL,
    "status"        TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_user_email_key" ON "app_user" ("email");
CREATE INDEX "app_user_org_id" ON "app_user" ("org_id");
