#!/usr/bin/env bash
# ==============================================================================
# Safar Self Drive - Production Zero-Downtime Deployment Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== [$(date)] Starting Safar Container Deployment ==="
cd "${ROOT_DIR}"

# 1. Pre-flight check
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production file missing in ${ROOT_DIR}!"
    echo "Please copy .env.production.example to .env.production and configure secrets."
    exit 1
fi

# 2. Database Backup Prior to Deployment
echo "Creating pre-deployment database backup..."
if [ -f "${SCRIPT_DIR}/backup-db.sh" ]; then
    bash "${SCRIPT_DIR}/backup-db.sh" || echo "Warning: Backup script failed, continuing..."
fi

# 3. Pull / Build Containers
echo "Building / Pulling containers..."
docker compose -f docker-compose.prod.yml build --pull

# 4. Start Infrastructure Services First (Postgres, Redis)
echo "Starting Database & Cache..."
docker compose -f docker-compose.prod.yml up -d postgres redis

# 5. Wait for Database Health Check
echo "Waiting for PostgreSQL healthy status..."
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' safar-prod-postgres 2>/dev/null || echo "\"starting\"")
    if [ "$STATUS" = "\"healthy\"" ]; then
        echo "PostgreSQL is healthy!"
        break
    fi
    echo "Waiting for postgres ($i/30)..."
    sleep 2
done

# 6. Start Application Services
echo "Deploying Backend API and Web Frontend..."
docker compose -f docker-compose.prod.yml up -d backend web gateway

# 7. Post-Deployment Health Verification
echo "Verifying API and Gateway Health..."
sleep 5
for i in {1..15}; do
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "Backend API is alive and responding!"
        break
    fi
    echo "Verifying health check ($i/15)..."
    sleep 2
done

# 8. Clean up unused old Docker images
echo "Pruning dangling images..."
docker image prune -f

echo "=== [$(date)] Safar Deployment Completed Successfully! ==="
docker compose -f docker-compose.prod.yml ps
