#!/bin/bash
set -e

echo "=== [$(date)] Starting Safar Auto-Deployment ==="
cd /home/ubuntu/ZipTrip

# Check if there are updates on remote main
git fetch origin main

LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/main)

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    # No changes to deploy
    exit 0
fi

echo "New commits detected ($LOCAL_HASH -> $REMOTE_HASH). Pulling and building..."

# Reset hard to remote main cleanly
git reset --hard origin/main

# Build backend and sync database
cd /home/ubuntu/ZipTrip/apps/backend
npm install --include=dev
npm run db:pg:prepare
npx prisma db push --accept-data-loss
npm run db:generate
npm run seed
npm run build

# Sync web frontend to nginx directory
sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/

# Restart PM2 process
pm2 restart 0

echo "=== [$(date)] Safar Auto-Deployment Complete! ==="
