#!/usr/bin/env bash
# Update an existing Safar installation; never seed or replace its database.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/apps/backend"
command -v node >/dev/null
command -v npm >/dev/null
command -v pm2 >/dev/null
[[ -f "$BACKEND/.env" ]] || { echo 'Keep the existing server apps/backend/.env in this checkout before updating.' >&2; exit 1; }
cd "$BACKEND"
export NODE_ENV=production
node -e 'const major=Number(process.versions.node.split(".")[0]);if(major<22){throw new Error("Node.js 22 or newer is required")}'
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
  sudo rsync -a "$ROOT/apps/web/" /var/www/safar/
fi
if pm2 describe safar-portal >/dev/null 2>&1; then
  pm2 restart safar-portal --update-env
else
  pm2 start "$BACKEND/dist/main.js" --name safar-portal --cwd "$BACKEND" --update-env
fi
pm2 save
for attempt in {1..20}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
    echo 'Safar API is responding on port 3000. Check the browser login using a configured server account.'
    exit 0
  fi
  sleep 1
done
echo 'Health check failed; inspect: pm2 logs safar-portal --lines 60 --nostream' >&2
exit 1
