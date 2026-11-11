# ==============================================================================
# Multi-Stage Dockerfile for Safar Self Drive API
# Node.js 22 + NestJS + Prisma ORM + Python Document Engine
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base Runtime Dependencies
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime utilities, python3, dumb-init, and curl for health check probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    ca-certificates \
    openssl \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ------------------------------------------------------------------------------
# Stage 2: Dependencies & Build Stage
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native compilation dependencies for build-time tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for optimal Docker layer caching
COPY apps/backend/package*.json ./
RUN npm ci

# Copy backend source code and Prisma configuration
COPY apps/backend/ ./

# Prepare PostgreSQL schema and generate Prisma client
RUN node scripts/prepare-postgres.js \
    && npx prisma generate --config prisma.postgres.config.ts \
    && npx prisma generate \
    && npm run build

# Prune devDependencies to keep container footprint minimal
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime
# ------------------------------------------------------------------------------
FROM base AS runner

WORKDIR /app

# Isolated Python virtual environment for agreement and invoice rendering
COPY apps/backend/requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH"
ENV AGREEMENT_PYTHON="/opt/venv/bin/python3"

# Copy compiled artifacts, schemas, scripts, and runtime dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma.postgres.config.ts ./
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint wrapper
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Run as unprivileged node user
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Container liveness & readiness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
