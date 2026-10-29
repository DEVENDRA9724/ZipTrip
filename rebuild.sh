#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "=== [$(date)] Rebuilding Safar Platform in ${REPO_DIR} ==="
cd "${REPO_DIR}/apps/backend"
node scripts/prepare-postgres.js
npx prisma db push --accept-data-loss
npx prisma generate
npm run build
node scripts/seed.js

sudo mkdir -p /var/www/safar
sudo cp -r "${REPO_DIR}/apps/web/"* /var/www/safar/

sudo fuser -k 3000/tcp 2>/dev/null || true
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete all 2>/dev/null || true
  cd "${REPO_DIR}/apps/backend"
  pm2 start dist/main.js --name safar-portal --cwd "${REPO_DIR}/apps/backend" --update-env
  pm2 save
  sleep 3
  pm2 status
  pm2 logs safar-portal --lines 20 --nostream
elif systemctl list-unit-files | grep -q safar; then
  sudo systemctl restart safar* || true
else
  cd "${REPO_DIR}/apps/backend"
  nohup node dist/main.js > /tmp/safar-backend.log 2>&1 &
  sleep 3
  tail -n 20 /tmp/safar-backend.log || true
fi
sudo systemctl reload nginx 2>/dev/null || true

echo "=== [$(date)] Rebuild & Deployment Complete! ==="
