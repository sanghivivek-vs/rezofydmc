# Runbook — view & test the DMC platform locally

Two processes: the **API** (NestJS, port 3000) and the **SPA** (Vite, port 5173).
The SPA dev server proxies `/v1/*` to the API.

## 1. Start the API

```bash
# from repo root
JWT_SECRET=dev-secret PORT=3000 npm run start:dev
# → "DMC platform API listening on :3000 (persistence: memory)"
```

In-memory persistence is the default (data resets on restart). For PostgreSQL,
set `PERSISTENCE=prisma` and a `DATABASE_URL` after `npm run prisma:migrate`
(ADR 0009).

## 2. Start the SPA

```bash
cd web && npm run dev
# → http://localhost:5173
```

## 3. Create a tenant and log in

The first call bootstraps a tenant + its Owner (no data is seeded otherwise):

```bash
curl -s -X POST localhost:3000/v1/auth/register-org -H 'content-type: application/json' \
  -d '{"org":{"name":"Alpine DMC","defaultCurrency":"INR","defaultMarkupPercent":15},
       "owner":{"email":"owner@alpine.test","name":"Olivia Owner","password":"password123"}}'
```

Then open `http://localhost:5173`, log in with `owner@alpine.test / password123`.

## 4. What to click

- **Team** — add team members, change roles, enable/disable accounts, reset
  passwords, change your own password. (Owner-only actions are hidden for others.)
- **Settings → Channels** — enable email/SMS/WhatsApp, pick a provider
  (logging/twilio/gupshup/heydoot), set the sender, and **Send test**. With the
  `logging` provider the send is logged by the API (no external account needed);
  the row shows `sent` / `skipped` / `failed`.
- **Settings → Trigger rules** — choose, per event, the audience (team / actor /
  customer) and channels. Customer delivery is **fail-closed** until consent +
  contacts are wired.
- **Notifications** — in-app feed with unread badge; trigger one by changing an
  enquiry's status under **Enquiries**.

## 5. Test messaging from the API directly

```bash
TOKEN=...   # from login/register response
# enable email via the logging provider
curl -s -X PUT localhost:3000/v1/notifications/channels -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"channels":[{"channel":"email","enabled":true,"provider":"logging","from":"ops@alpine.test"}]}'
# send a test
curl -s -X POST localhost:3000/v1/notifications/channels/test -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"channel":"email","to":"someone@alpine.test"}'
```

Changing an enquiry status (`POST /v1/enquiries/:id/status`) fires the routing
rules: watch the API log for `[Message]` lines showing the team email dispatch.

## 6. Real providers

Set credentials in the API environment, then point a channel's `provider` at it:

| Provider | Env vars |
| --- | --- |
| Twilio  | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| Gupshup | `GUPSHUP_API_KEY` |
| Heydoot | `HEYDOOT_API_KEY`, `HEYDOOT_BASE_URL` (optional) |

Credentials live only in server config — never in tenant data or the API
responses (ADR 0007, ADR 0010).

## Tests

```bash
npm test            # backend (jest)
cd web && npm test  # SPA (vitest)
```
