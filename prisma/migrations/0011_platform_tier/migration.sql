-- DMC Platform — platform (super-admin) tier (Build guide §3 tenancy).
-- Adds tenant governance/status owned by the platform, and the platform_admin
-- store. Additive migration; never edit applied migrations.

ALTER TABLE "organization" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "organization" ADD COLUMN "governance" JSONB NOT NULL DEFAULT '{"customerMessagingAllowed": false}';

CREATE TABLE "platform_admin" (
    "id"            TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "status"        TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admin_email_key" ON "platform_admin" ("email");
