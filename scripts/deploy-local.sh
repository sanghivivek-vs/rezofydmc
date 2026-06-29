#!/usr/bin/env bash
#
# One-command local deploy for testing (no Docker).
# Builds the SPA, then runs the API serving it from a single URL (default :3000).
#
# Data store: in-memory by default (resets on restart). For PostgreSQL, set
# PERSISTENCE=prisma and DATABASE_URL, and run `npm run prisma:migrate` first.
#
# Override any of these via the environment before invoking:
set -euo pipefail

export PORT="${PORT:-3000}"
export JWT_SECRET="${JWT_SECRET:-local-dev-secret-change-me}"
export PLATFORM_BOOTSTRAP_SECRET="${PLATFORM_BOOTSTRAP_SECRET:-local-bootstrap-secret}"
export SERVE_WEB="${SERVE_WEB:-web/dist}"

echo "▶ Building the web app…"
npm --prefix web install --no-audit --no-fund
npm --prefix web run build

echo "▶ Starting the DMC platform on http://localhost:${PORT}"
echo "  persistence: ${PERSISTENCE:-memory}   web: ${SERVE_WEB}"
exec npm start
