#!/bin/bash
set -e

echo "=== [$(date)] Rebuilding Safar Platform ==="
cd /home/ubuntu/ZipTrip/apps/backend
node scripts/prepare-postgres.js
npx prisma db push --accept-data-loss
npx prisma generate
node scripts/seed.js

sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/
pm2 restart 0 || pm2 start dist/main.js --name safar-api
pm2 status

echo "=== [$(date)] Rebuild & Deployment Complete! ==="
