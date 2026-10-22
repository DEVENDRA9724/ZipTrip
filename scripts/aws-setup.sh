#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "  SAFAR SELF DRIVE — AWS EC2 + S3 PRODUCTION DEPLOYMENT SCRIPT  "
echo "================================================================"

# 1. Collect AWS & Domain Configuration
read -rp "Enter your S3 Bucket Name (e.g. safar-media-prod): " S3_BUCKET_INPUT
read -rp "Enter your AWS Region [default: ap-south-1]: " AWS_REGION_INPUT
AWS_REGION_VAL="${AWS_REGION_INPUT:-ap-south-1}"

read -rp "Enter your Public Domain or EC2 IP (e.g. https://safarselfdrive.com or http://13.232.x.x): " WEB_ORIGIN_INPUT
WEB_ORIGIN_VAL="${WEB_ORIGIN_INPUT:-http://localhost:3000}"

read -rp "Are you using an EC2 IAM Role for S3 access? (y/n) [default: y]: " USE_IAM_ROLE
USE_IAM_ROLE="${USE_IAM_ROLE:-y}"

AWS_ACCESS_KEY_ID_VAL=""
AWS_SECRET_ACCESS_KEY_VAL=""
if [[ "${USE_IAM_ROLE,,}" == "n" ]]; then
  read -rp "Enter AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID_VAL
  read -rsp "Enter AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY_VAL
  echo ""
fi

echo ""
echo "[1/6] Checking memory (creating 2GB swap for t2.micro/t3.micro) & installing system packages..."
if [[ ! -f /swapfile ]]; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "  -> Enabled 2GB swap memory for smooth TypeScript/Prisma builds on t2.micro."
fi

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y curl git nginx python3 python3-pip python3-venv docker.io docker-compose-v2
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  sudo systemctl enable --now docker
  sudo systemctl enable --now nginx
fi

# 2. Setup Python virtual environment for Agreement PDF/DOCX generation
echo "[2/6] Configuring Python environment for Rental Agreement PDF/DOCX rendering..."
python3 -m venv "$PWD/.venv" || true
"$PWD/.venv/bin/pip" install --upgrade pip python-docx reportlab

# 3. Start PostgreSQL container via Docker Compose
echo "[3/6] Starting PostgreSQL 15 database container..."
sudo docker compose up -d postgres
sleep 4

# 4. Generate cryptographic secrets & write apps/backend/.env
echo "[4/6] Generating production secrets and writing apps/backend/.env..."
JWT_SECRET_VAL=$(openssl rand -hex 32)
DOC_KEY_VAL=$(openssl rand -hex 32)
PAYOUT_KEY_VAL=$(openssl rand -hex 32)
DB_URL="postgresql://root:rootpassword@localhost:5432/ziptrip?schema=public"

cat > apps/backend/.env <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=${DB_URL}
POSTGRES_DATABASE_URL=${DB_URL}
JWT_SECRET=${JWT_SECRET_VAL}
WEB_ORIGIN=${WEB_ORIGIN_VAL}
UPLOAD_DIR=./uploads

# AWS S3 Object Storage
AWS_REGION=${AWS_REGION_VAL}
S3_BUCKET=${S3_BUCKET_INPUT}
S3_PREFIX=safar-media
S3_FORCE_PATH_STYLE=false
$( [[ -n "$AWS_ACCESS_KEY_ID_VAL" ]] && echo "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID_VAL}" )
$( [[ -n "$AWS_SECRET_ACCESS_KEY_VAL" ]] && echo "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY_VAL}" )

# AES-256-GCM Encryption Keys (64 hex chars)
DOCUMENT_ENCRYPTION_KEY=${DOC_KEY_VAL}
PAYOUT_ENCRYPTION_KEY=${PAYOUT_KEY_VAL}

# DigiLocker / Sandbox eKYC
SANDBOX_ENV=test
SANDBOX_API_KEY=
SANDBOX_API_SECRET=
KYC_REDIRECT_URL=${WEB_ORIGIN_VAL}/kyc.html

# Agreement Generator
BUSINESS_NAME=Safar Self Drive
BUSINESS_LEGAL_NAME=Safar Self Drive
AGREEMENT_PYTHON=$PWD/.venv/bin/python
EOF

chmod 600 apps/backend/.env

# 5. Install dependencies, push PostgreSQL schema, and build backend
echo "[5/6] Installing Node packages, pushing PostgreSQL schema, and building backend..."
cd apps/backend
npm install
npm run db:pg:prepare
npm run db:pg:generate
npm run db:pg:push
npm run build
cd ../..

# 6. Configure PM2 & Nginx Reverse Proxy (Port 80 -> Port 3000)
echo "[6/6] Starting Safar Backend with PM2 and configuring Nginx on Port 80..."
sudo npm install -g pm2
pm2 delete safar-portal >/dev/null 2>&1 || true
pm2 start dist/main.js --name safar-portal --cwd "$PWD/apps/backend"
pm2 save

if [[ -d /etc/nginx/sites-available ]]; then
  sudo tee /etc/nginx/sites-available/safar >/dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
  sudo ln -sf /etc/nginx/sites-available/safar /etc/nginx/sites-enabled/safar
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "================================================================"
echo "  ✅ SAFAR SELF DRIVE IS LIVE ON AWS!                           "
echo "  Portal URL: ${WEB_ORIGIN_VAL}                                 "
echo "  S3 Bucket:  ${S3_BUCKET_INPUT} (${AWS_REGION_VAL})            "
echo "================================================================"
echo "Next: Create your Admin account by running:"
echo "  cd apps/backend && ADMIN_EMAIL=admin@safar.in ADMIN_PASSWORD='YourStrongPassword123!' npm run admin:create"
