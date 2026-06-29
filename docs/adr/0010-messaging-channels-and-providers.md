# ADR 0010 — Multi-provider messaging channels (email / SMS / WhatsApp)

- **Status:** Accepted
- **Date:** 2026-06-29

## Context

The platform must reach customers, agency partners, and internal team members
over multiple channels (email, SMS, WhatsApp) using third-party providers such
as Twilio, Gupshup, and Heydoot. Different tenants will prefer different
providers and senders, and the market (notably India) is split across them. We
need provider choice to be **per-tenant configuration, not code**, and we must
not store provider credentials in tenant data.

## Decision

- **Port + adapters.** A `MessageProvider` port (`send(message, from)`) has one
  adapter per backend: `LoggingMessageProvider` (default), `TwilioProvider`,
  `GupshupProvider`, `HeydootProvider`. The notifications layer talks only to the
  port. New providers are added by writing one adapter.
- **Per-tenant channel config.** `OrgSettings.channels: ChannelConfig[]` holds,
  per channel, `{ enabled, provider, from }`. Stored in the existing org
  `settings` JSON — **no schema migration**. Managed via
  `GET/PUT /v1/notifications/channels` (read: any tenant user; write: Owner).
- **Credentials live in server config, not tenant data (ADR 0007).** The
  `ProviderRegistry` resolves provider credentials from environment config
  (`TWILIO_*`, `GUPSHUP_API_KEY`, `HEYDOOT_API_KEY`, …). Tenants choose the
  provider and the **sender identity** (`from`); they never submit secrets, and
  the API never returns them.
- **Safe by default.** Unknown/unset providers fall back to the logging adapter,
  so the platform always runs with no messaging credentials (sandbox, tests,
  fresh installs). Channels start disabled.
- **Failure is data, not an exception.** `MessageService.send` returns a
  `DeliveryResult` (`sent | skipped | failed`); a provider error is recorded as
  `failed` and never propagates into the business write that triggered it.
- **Verifiable.** `POST /v1/notifications/channels/test` (Owner) sends a test
  message through a channel and returns the `DeliveryResult`.

## Consequences

- Adding a provider = one adapter + one `ProviderRegistry` case + an env var.
- Live provider calls only run in a configured environment; the sandbox/CI path
  exercises selection logic and the logging adapter (unit + e2e tested).
- **Open item (see decisions-to-confirm):** credentials are currently
  **platform-level** (one provider account, per-tenant sender). Per-tenant
  provider credentials (each DMC bringing its own Twilio/Gupshup account) is a
  future enhancement — it needs a secret-storage decision (KMS / vault) before
  tenant-supplied secrets can be accepted.
