#!/bin/bash
set -e

echo "=== [$(date)] Rebuilding Safar Platform ==="
cd /home/ubuntu/ZipTrip/apps/backend
node scripts/prepare-postgres.js
npx prisma db push --accept-data-loss
npx prisma generate
node scripts/seed.js

sudo mkdir -p /var/www/safar
sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/
pm2 restart all || pm2 start dist/main.js --name safar-portal
pm2 status

echo "=== [$(date)] Rebuild & Deployment Complete! ==="
