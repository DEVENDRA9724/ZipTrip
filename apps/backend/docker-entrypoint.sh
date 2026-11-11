#!/bin/sh
set -e

echo "=== [Safar API] Initializing Production Container ==="

# Wait for PostgreSQL if DATABASE_URL or POSTGRES_DATABASE_URL is set
if [ -n "$DATABASE_URL" ] || [ -n "$POSTGRES_DATABASE_URL" ]; then
  DB_TARGET="${POSTGRES_DATABASE_URL:-$DATABASE_URL}"
  echo "[Safar API] PostgreSQL detected in environment."
  
  # Run schema migrations safely if enabled
  if [ "$RUN_MIGRATIONS_ON_STARTUP" = "true" ]; then
    echo "[Safar API] RUN_MIGRATIONS_ON_STARTUP is enabled. Applying database migrations..."
    if [ -f "prisma.postgres.config.ts" ]; then
      npx prisma migrate deploy --config prisma.postgres.config.ts || {
        echo "[Safar API] Warning: prisma migrate deploy encountered an error. Continuing startup..."
      }
    else
      npx prisma migrate deploy || {
        echo "[Safar API] Warning: prisma migrate deploy encountered an error. Continuing startup..."
      }
    fi
  else
    echo "[Safar API] Skipping automatic migrations (RUN_MIGRATIONS_ON_STARTUP != true)."
  fi
fi

echo "[Safar API] Starting NestJS Application Process..."
exec "$@"
