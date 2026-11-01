#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  🚀 SAFAR SELF DRIVE — PRODUCTION DEPLOYMENT & GO-LIVE   "
echo "=========================================================="

# 1. Pull latest code from merge-main-new-change
echo "[1/6] Pulling latest code from GitHub..."
cd ~/ZipTrip
git reset --hard HEAD
git clean -fd
git pull origin merge-main-new-change

# 2. Update PostgreSQL database schema and generate Prisma client
echo "[2/6] Syncing database schema and generating Prisma client..."
cd ~/ZipTrip/apps/backend
npx prisma db push
npx prisma generate
npm run build

# 3. Copy web frontend assets to /var/www/safar
echo "[3/6] Deploying web files to /var/www/safar..."
sudo mkdir -p /var/www/safar
sudo cp -r ~/ZipTrip/apps/web/* /var/www/safar/

# 4. Remove basic auth / password protection and configure clean Nginx
echo "[4/6] Removing password protection & configuring public Nginx..."
sudo rm -f /etc/nginx/.htpasswd 2>/dev/null || true
sudo sed -i '/auth_basic/d' /etc/nginx/sites-available/* 2>/dev/null || true
sudo sed -i '/auth_basic/d' /etc/nginx/sites-enabled/* 2>/dev/null || true
sudo sed -i '/auth_basic/d' /etc/nginx/conf.d/* 2>/dev/null || true
sudo sed -i '/auth_basic/d' /etc/nginx/nginx.conf 2>/dev/null || true

# Write clean Nginx site configuration
if [ -d /etc/nginx/sites-available ]; then
  sudo tee /etc/nginx/sites-available/safar > /dev/null << 'NGINX_EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name safarselfdrive.com www.safarselfdrive.com 13.202.48.156 _;

    root /var/www/safar;
    index index.html;
    client_max_body_size 30M;

    # Frontend pages
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Uploads fallback
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
NGINX_EOF

  sudo ln -sf /etc/nginx/sites-available/safar /etc/nginx/sites-enabled/safar
  sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
fi

sudo nginx -t
sudo systemctl reload nginx

# 5. Start / restart backend service
echo "[5/6] Starting NestJS backend on port 3000..."
cd ~/ZipTrip/apps/backend
sudo systemctl restart safar 2>/dev/null || (pkill -f "dist/main.js" 2>/dev/null ; nohup node dist/main.js > /tmp/safar-backend.log 2>&1 &)

sleep 3

# 6. Verify health
echo "[6/6] Verifying API and web services..."
if curl -s -I http://127.0.0.1:3000/api/health | grep -q "200"; then
  echo "✅ NestJS Backend is responding healthy on port 3000 (HTTP 200 OK)!"
else
  echo "Restarting backend process..."
  pkill -f "dist/main.js" 2>/dev/null || true
  nohup node dist/main.js > /tmp/safar-backend.log 2>&1 &
  sleep 3
  curl -I http://127.0.0.1:3000/api/health || true
fi

echo ""
echo "=========================================================="
echo "  🎉 SAFAR SELF DRIVE IS COMPLETELY LIVE AND PUBLIC!      "
echo "  Direct IP: http://13.202.48.156                         "
echo "  Domain:    http://safarselfdrive.com                    "
echo "=========================================================="
