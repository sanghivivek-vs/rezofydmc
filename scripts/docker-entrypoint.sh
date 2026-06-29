#!/usr/bin/env bash
set -euo pipefail

# Apply DB migrations when running against PostgreSQL; in-memory needs nothing.
if [ "${PERSISTENCE:-memory}" = "prisma" ]; then
  echo "▶ Applying database migrations…"
  npx prisma migrate deploy
fi

echo "▶ Starting DMC platform (persistence: ${PERSISTENCE:-memory})"
exec npm start
