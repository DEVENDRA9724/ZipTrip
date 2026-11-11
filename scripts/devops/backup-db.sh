#!/usr/bin/env bash
# ==============================================================================
# Safar Self Drive - Automated PostgreSQL Backup Script
# Creates compressed database dumps with automated 14-day retention pruning.
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/safar-backups}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/safar_db_${TIMESTAMP}.sql.gz"

echo "[$(date)] Taking PostgreSQL snapshot from safar-prod-postgres..."

# Stream gzipped database dump
docker exec -t safar-prod-postgres pg_dump -U safar_admin safar_production | gzip > "${FILENAME}"

SIZE=$(du -h "${FILENAME}" | cut -f1)
echo "[$(date)] Backup completed: ${FILENAME} (${SIZE})"

# Prune backups older than 14 days
echo "[$(date)] Pruning snapshots older than 14 days..."
find "${BACKUP_DIR}" -type f -name "safar_db_*.sql.gz" -mtime +14 -delete

echo "[$(date)] Snapshot drill finished."
