# Runbook — view & test the DMC platform locally

You can run the whole thing on your own machine — no cloud required. Pick one:

| Mode                                           | Command                                       | URL                   | Data                  | Needs   |
| ---------------------------------------------- | --------------------------------------------- | --------------------- | --------------------- | ------- |
| **A. Dev** (hot reload)                        | `npm run start:dev` + `cd web && npm run dev` | http://localhost:5173 | in-memory             | Node 20 |
| **B. One-command deploy** (API serves the SPA) | `npm run deploy:local`                        | http://localhost:3000 | in-memory*            | Node 20 |
| **C. Docker + PostgreSQL**                     | `docker compose up --build`                   | http://localhost:3000 | PostgreSQL (persists) | Docker  |

\* Mode B can also use PostgreSQL — set `PERSISTENCE=prisma` + `DATABASE_URL`
(start Postgres with `docker compose up -d postgres`, then `npm run prisma:migrate`).

Sections 1–2 below are **Mode A**. Mode B/C are in **§8**. After the app is up,
§3–§7 (create a tenant, log in, what to click, super-admin) apply to all modes —
just use the right base URL (`:5173` for dev, `:3000` for B/C).

## 0. macOS quickstart (from scratch)

```bash
# 1. Install Homebrew (skip if you already have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install Node.js 20+ LTS and git
brew install node git
node -v   # should print v20.x or newer

# 3. Get the code (this feature branch)
git clone -b claude/dmc-platform-build-guide-s9to6n \
  https://github.com/sanghivivek-vs/rezofydmc.git
cd rezofydmc

# 4. Install backend dependencies
npm install

# 5. Run the whole app on one URL (builds the web UI, then serves it)
npm run deploy:local
# → open http://localhost:3000
```

`deploy:local` uses safe default secrets and in-memory data (resets on restart).
Leave it running; open a **second terminal** for the curl commands below.

```bash
# 6. Create your first tenant + Owner login
curl -s -X POST localhost:3000/v1/auth/register-org -H 'content-type: application/json' \
  -d '{"org":{"name":"Alpine DMC","defaultCurrency":"INR"},
       "owner":{"email":"owner@alpine.test","name":"Olivia","password":"password123"}}'
# Now log in at http://localhost:3000 with owner@alpine.test / password123

# 7. (Optional) Create the super-admin, then open http://localhost:3000/platform
curl -s -X POST localhost:3000/v1/platform/auth/bootstrap \
  -H 'x-platform-bootstrap: local-bootstrap-secret' -H 'content-type: application/json' \
  -d '{"email":"root@platform.test","name":"Root","password":"rootpass123"}'
```

To stop: press `Ctrl+C` in the first terminal. To start again later, just
`cd rezofydmc && npm run deploy:local`. Apple-silicon (M-series) and Intel Macs
both work.

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

### Seed realistic demo data (recommended)

So the app isn't empty, populate a demo tenant ("Wanderlust DMC") with suppliers,
rate cards, enquiries across the pipeline, itineraries, quotes, and bookings:

```bash
npm run seed                       # against http://localhost:3000 by default
# BASE=http://localhost:8080 npm run seed   # custom URL
```

Then log in with **owner@demo.test / demo1234** — the Dashboard lands populated.

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

| Provider | Env vars                                         |
| -------- | ------------------------------------------------ |
| Twilio   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`        |
| Gupshup  | `GUPSHUP_API_KEY`                                |
| Heydoot  | `HEYDOOT_API_KEY`, `HEYDOOT_BASE_URL` (optional) |

Credentials live only in server config — never in tenant data or the API
responses (ADR 0007, ADR 0010).

## 7. Super-admin (platform) console

The platform tier sits ABOVE all tenants with its own login. Start the API with
a bootstrap secret:

```bash
JWT_SECRET=dev-secret PLATFORM_BOOTSTRAP_SECRET=boot-secret PORT=3000 npm run start:dev
```

Create the first super-admin (one-time; refuses once an admin exists):

```bash
curl -s -X POST localhost:3000/v1/platform/auth/bootstrap \
  -H 'x-platform-bootstrap: boot-secret' -H 'content-type: application/json' \
  -d '{"email":"root@platform.test","name":"Root","password":"rootpass123"}'
```

Then open **`http://localhost:5173/platform`** and sign in with
`root@platform.test / rootpass123`. From the console you can:

- **Broadcast** an announcement to all tenants (in-app + email via each tenant's
  channel).
- **Suspend / unsuspend** a tenant — a suspended tenant's users cannot log in.
- **Allow / block** a tenant's customer messaging (platform governance).

The tenant side: in the tenant app, **Settings → Customer & partner messaging**
lets a tenant Owner turn customer messaging on — it only becomes _effective_ once
the platform has allowed it (and consent is in place).

Same powers via the API:

```bash
PTOKEN=$(curl -s -X POST localhost:3000/v1/platform/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"root@platform.test","password":"rootpass123"}' | jq -r .token)
curl -s localhost:3000/v1/platform/tenants -H "authorization: Bearer $PTOKEN"
curl -s -X POST localhost:3000/v1/platform/broadcast -H "authorization: Bearer $PTOKEN" \
  -H 'content-type: application/json' -d '{"subject":"Notice","message":"Hello tenants"}'
```

## 8. Local deploy (one URL)

### Mode B — single process, no Docker

The API serves the built SPA, so the whole app is at **http://localhost:3000**:

```bash
npm run deploy:local
# builds web/ then starts the API with SERVE_WEB=web/dist
```

It uses safe default secrets and in-memory data. Override anything via the env:

```bash
JWT_SECRET=my-secret PORT=8080 npm run deploy:local            # custom secret/port
PERSISTENCE=prisma DATABASE_URL=postgres://… npm run deploy:local  # use PostgreSQL
```

Manual equivalent: `npm run build:web` then
`SERVE_WEB=web/dist JWT_SECRET=… npm start`.

### Mode C — Docker + PostgreSQL (persistent)

```bash
docker compose up --build      # → http://localhost:3000, data in a Postgres volume
```

Migrations run automatically on start. To stop and wipe the DB volume:
`docker compose down -v`. (Override `JWT_SECRET` / `PLATFORM_BOOTSTRAP_SECRET`
via your shell or a `.env` file — see `.env.example`.)

Then bootstrap the super-admin (§7) and register a tenant (§3) against
`http://localhost:3000`.

## Tests

```bash
npm test            # backend (jest)
cd web && npm test  # SPA (vitest)
```
