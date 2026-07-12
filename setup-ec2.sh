#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo " Starting ZipTrip Platform Deployment on AWS EC2..."
echo "=========================================================="

# 1. Update system packages
echo "[1/8] Updating system apt repositories..."
sudo apt update -y

# 2. Install Node.js v20 LTS
echo "[2/8] Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify versions
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install Nginx and PM2 globally
echo "[3/8] Installing PM2 and Nginx..."
sudo npm install pm2 -g
sudo apt install nginx -y

# 4. Clone ZipTrip from GitHub
echo "[4/8] Fetching codebase from Git repository..."
cd /home/ubuntu
rm -rf ZipTrip
git clone https://github.com/DEVENDRA9724/ZipTrip.git
cd ZipTrip

# 5. Install & Build Backend
echo "[5/8] Configuring Backend services & database..."
cd backend
npm install

# Write environment configuration
cat <<EOF > .env
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET="ZipTripSuperSecretProductionKey2026!"
EOF

# Run Prisma migrations & seed database
npx prisma migrate deploy
npm run db:seed

# Build & Start backend process under PM2 daemon
npm run build
pm2 start dist/server.js --name "ziptrip-backend"

# 6. Install & Build Frontend
echo "[6/8] Configuring Next.js Frontend assets..."
cd ../frontend
npm install

# Query public IP via standard AWS metadata endpoint (fallback to ifconfig.me)
PUBLIC_IP=$(curl -s --timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 || curl -s ifconfig.me || echo "localhost")
echo "Detected Server IP: $PUBLIC_IP"

# Write client-side environment targets
echo "NEXT_PUBLIC_API_URL=\"http://$PUBLIC_IP/api\"" > .env.local

# Compile production package & Start under PM2
npm run build
pm2 start npm --name "ziptrip-frontend" -- -- start

# 7. Configure PM2 Startup
echo "[7/8] Saving PM2 process lists for server reboots..."
pm2 save
# Generate startup commands
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu || true

# 8. Configure Nginx Reverse Proxy
echo "[8/8] Writing Nginx proxy configuration..."
cat <<EOF | sudo tee /etc/nginx/sites-available/default
server {
    listen 80;
    server_name $PUBLIC_IP;

    # Next.js Server proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Express API Server proxy
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Test Nginx syntax and reload server
sudo nginx -t
sudo systemctl restart nginx

echo "=========================================================="
echo " ZipTrip Deployment Completed Successfully!"
echo " Access your live web portal at: http://$PUBLIC_IP"
echo "=========================================================="
