#!/usr/bin/env bash
# Update an existing Safar installation; never seed or replace its database.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command -v node >/dev/null
command -v npm >/dev/null
command -v curl >/dev/null
command -v rsync >/dev/null
MANAGER=pm2
TARGET_ROOT="$ROOT"
if command -v systemctl >/dev/null && [[ "$(systemctl show safar-portal.service -p LoadState --value 2>/dev/null)" == loaded ]]; then
  MANAGER=systemd
  SERVICE_DIR="$(systemctl show safar-portal.service -p WorkingDirectory --value)"
  # Use the paths in the existing service; never start another API on its port.
  if [[ "$SERVICE_DIR" == /*/apps/backend && -f "$SERVICE_DIR/src/main.ts" ]]; then
    TARGET_ROOT="${SERVICE_DIR%/apps/backend}"
  elif [[ "$SERVICE_DIR" == /* && -f "$SERVICE_DIR/apps/backend/src/main.ts" ]]; then
    TARGET_ROOT="$SERVICE_DIR"
  else
    echo 'Cannot identify the Safar application from the systemd WorkingDirectory. Inspect: systemctl show safar-portal.service -p WorkingDirectory -p ExecStart' >&2
    exit 1
  fi
else
  command -v pm2 >/dev/null || { echo 'Neither safar-portal.service nor PM2 was found.' >&2; exit 1; }
fi
BACKEND="$TARGET_ROOT/apps/backend"
[[ -f "$BACKEND/.env" ]] || { echo 'Keep the existing server apps/backend/.env in this checkout before updating.' >&2; exit 1; }
node -e 'const major=Number(process.versions.node.split(".")[0]);if(major<22){throw new Error("Node.js 22 or newer is required")}'
if [[ "$(cd "$TARGET_ROOT" && pwd -P)" != "$(cd "$ROOT" && pwd -P)" ]]; then
  # Stage the branch's code in the service's existing installation. Runtime files
  # and dependencies are preserved; npm ci below replaces dependencies there.
  BACKUP_DIR="$(dirname "$TARGET_ROOT")/safar-code-backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$(mktemp "$BACKUP_DIR/code-$(date +%Y%m%d-%H%M%S)-XXXXXX.tar.gz")"
  tar --exclude='.git' --exclude='node_modules' --exclude='dist' \
      --exclude='uploads' --exclude='backups' --exclude='.env' --exclude='.env.*' \
      --exclude='*.db*' --exclude='*.log' --exclude='*.zip' --exclude='*.tar.gz' \
      -czf "$BACKUP_FILE" -C "$TARGET_ROOT" .
  rsync -a --exclude='.git/' --exclude='node_modules/' --exclude='dist/' \
      --exclude='uploads/' --exclude='backups/' --exclude='.env' --exclude='.env.*' \
      --exclude='*.db*' --exclude='*.log' --exclude='*.zip' --exclude='*.tar.gz' \
      --exclude='*.tsbuildinfo' "$ROOT/" "$TARGET_ROOT/"
  echo "Updating the existing service installation: $TARGET_ROOT (code backup: $BACKUP_FILE)"
fi
cd "$BACKEND"
export NODE_ENV=production
npm ci --include=dev
node <<'NODE'
require('dotenv').config({ quiet: true });
const url = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL || '';
if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('Configure the existing PostgreSQL connection in apps/backend/.env. SQLite is a backup, not the production database.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) throw new Error('Configure JWT_SECRET in the server .env');
if (!process.env.S3_BUCKET) throw new Error('Configure the existing private S3 bucket in the server .env');
if (!/^[a-f0-9]{64}$/i.test(process.env.DOCUMENT_ENCRYPTION_KEY || '')) throw new Error('Preserve the existing DOCUMENT_ENCRYPTION_KEY in the server .env');
NODE
npm run db:pg:generate
npm run build
# Existing migrations/data are preserved. Apply reviewed schema migrations separately.
if [[ -d /var/www/safar ]]; then
  command -v rsync >/dev/null || { echo 'Install rsync to update the existing Nginx static web directory.' >&2; exit 1; }
  sudo rsync -a "$TARGET_ROOT/apps/web/" /var/www/safar/
fi
if [[ "$MANAGER" == systemd ]]; then
  sudo systemctl restart safar-portal.service
elif pm2 describe safar-portal >/dev/null 2>&1; then
  pm2 restart safar-portal --update-env
  pm2 save
else
  pm2 start "$BACKEND/dist/main.js" --name safar-portal --cwd "$BACKEND" --update-env
  pm2 save
fi
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
    echo 'Safar API is responding on port 3000. Check the browser login using a configured server account.'
    exit 0
  fi
  sleep 1
done
if [[ "$MANAGER" == systemd ]]; then
  echo 'Health check failed; inspect: sudo journalctl -u safar-portal.service -n 60 --no-pager' >&2
else
  echo 'Health check failed; inspect: pm2 logs safar-portal --lines 60 --nostream' >&2
fi
exit 1
