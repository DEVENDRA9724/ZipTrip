#!/bin/bash
set -e

echo "=== [$(date)] Rebuilding Safar Platform ==="
cd /home/ubuntu/ZipTrip/apps/backend
npm install --include=dev
npm run db:pg:prepare
npx prisma db push --accept-data-loss
npm run db:generate
npm run seed
npm run build

sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/
pm2 restart 0

echo "=== [$(date)] Rebuild & Deployment Complete! ==="
