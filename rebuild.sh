#!/bin/bash
set -e

echo "=== [$(date)] Rebuilding Safar Platform ==="
cd /home/ubuntu/ZipTrip/apps/backend
node scripts/prepare-postgres.js
npx prisma db push --accept-data-loss
npx prisma generate
npm run build
node scripts/seed.js

sudo mkdir -p /var/www/safar
sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/

sudo fuser -k 3000/tcp 2>/dev/null || true
pm2 delete safar-portal 2>/dev/null || true
cd /home/ubuntu/ZipTrip/apps/backend
pm2 start dist/main.js --name safar-portal --cwd /home/ubuntu/ZipTrip/apps/backend --update-env
pm2 save
sleep 3
pm2 status
pm2 logs safar-portal --lines 20 --nostream

echo "=== [$(date)] Rebuild & Deployment Complete! ==="
