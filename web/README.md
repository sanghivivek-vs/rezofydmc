# DMC Ops Console (web)

Internal operations console for the DMC platform — a React + Vite + TypeScript
SPA styled with Tailwind. It consumes the REST API (it is a thin rendering layer;
multi-tenancy and the owner-only margin gate are enforced server-side from the
JWT).

## Develop

```bash
npm install
# Run the API first (repo root): JWT_SECRET=dev npm run start:dev   # :3000
npm run dev          # Vite dev server on :5173, proxies /v1 -> :3000
```

Override the API target with `VITE_API_PROXY=http://host:port`.

## Scripts

```bash
npm run dev        # dev server (proxies /v1 to the API)
npm run build      # tsc --noEmit && vite build  -> dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest (jsdom)
```

## What's here

- **Auth** — login stores the JWT; `AuthContext` loads the current user (`/v1/users/me`).
  `RequireAuth` guards the app routes.
- **Enquiries** — list + create; detail view with quotes.
- **Quotes** — price a quote from a catalog component, send it (`quote.sent`), and
  open the rendered quote document. **Margins are shown only when the API returns
  them** (Owner role) — the SPA never decides that itself.
- **Catalog** — suppliers, components, and rate cards.

The API client (`src/api/client.ts`) is typed and maps the platform's error
envelope to `ApiError`.
