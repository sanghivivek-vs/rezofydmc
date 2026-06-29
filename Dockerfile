# DMC Platform — single-image local/test deploy.
# Builds the SPA and runs the API serving it from one port (3000).
# Works with in-memory (default) or PostgreSQL (PERSISTENCE=prisma).
FROM node:20-bookworm-slim

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install API deps first (better layer caching).
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Build the SPA.
COPY web/package*.json ./web/
RUN npm --prefix web ci --no-audit --no-fund
COPY web ./web
RUN npm --prefix web run build

# API source + Prisma schema.
COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma

# Generate the Prisma client (no DB needed at build time).
RUN npx prisma generate

# NOTE: NODE_ENV is intentionally left unset so this stays a relaxed *test*
# deploy — optional secrets (e.g. OUTBOUND_WEBHOOK_SECRET) fall back to dev
# placeholders instead of blocking boot. For a real production image, set
# NODE_ENV=production and provide every required secret.
ENV PORT=3000 \
    SERVE_WEB=/app/web/dist

EXPOSE 3000

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
