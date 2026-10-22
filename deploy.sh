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
node scripts/prepare-postgres.js
npx prisma db push --accept-data-loss
npx prisma generate
npm run build
node scripts/seed.js

# Sync web frontend to nginx directory
sudo mkdir -p /var/www/safar
sudo cp -r /home/ubuntu/ZipTrip/apps/web/* /var/www/safar/

# Restart PM2 process cleanly
sudo fuser -k 3000/tcp 2>/dev/null || true
pm2 delete safar-portal 2>/dev/null || true
cd /home/ubuntu/ZipTrip/apps/backend
pm2 start dist/main.js --name safar-portal --cwd /home/ubuntu/ZipTrip/apps/backend --update-env
pm2 save
sleep 3
pm2 status
pm2 logs safar-portal --lines 20 --nostream

echo "=== [$(date)] Safar Auto-Deployment Complete! ==="
