# Safar AWS deployment

The production shape is:

`Route 53/Cloudflare DNS → AWS App Runner (NestJS + static web) → RDS PostgreSQL`

Private uploads and KYC originals are stored in an S3 bucket. The bucket must
remain private; the API reads objects with its IAM role and authorizes every
`/api/media/:id` request before returning bytes. Redis is optional until
background jobs are enabled.

## 1. Create the AWS resources

Create these resources in one AWS region (Mumbai is `ap-south-1`):

1. An ECR repository for the backend image, for example `safar-api`.
2. An RDS PostgreSQL 15 or newer instance in private subnets. Do not expose
   port 5432 to the internet. Allow it only from the App Runner VPC connector
   security group.
3. A private S3 bucket such as `safar-production-media-<account-id>` with
   Block Public Access enabled, default SSE-S3 encryption, versioning enabled,
   and a lifecycle rule for old non-current versions.
4. An App Runner VPC connector with access to the RDS subnets and the S3 VPC
   endpoint (or NAT). The App Runner service should use an IAM instance role
   that can access only this bucket.
5. Secrets Manager entries for `DATABASE_URL`, `JWT_SECRET`,
   `DOCUMENT_ENCRYPTION_KEY`, Sandbox credentials, and business settings.

The S3 role needs only these actions on the bucket: `s3:GetObject`,
`s3:PutObject`, and `s3:DeleteObject`. It does not need `s3:*` or bucket
administration permissions.

## 2. Build and publish the API image

From the repository root, after installing and configuring the AWS CLI and
Docker:

```powershell
$region = "ap-south-1"
$account = (aws sts get-caller-identity --query Account --output text)
$repo = "$account.dkr.ecr.$region.amazonaws.com/safar-api"
aws ecr create-repository --repository-name safar-api --region $region
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$account.dkr.ecr.$region.amazonaws.com"
docker build -f apps/backend/Dockerfile -t safar-api .
docker tag safar-api:latest "$repo:latest"
docker push "$repo:latest"
```

The image contains the NestJS API, static frontend, Python agreement renderer,
and ReportLab fallback. It does not contain `.env`, the SQLite database, or
uploads.

## 3. Configure the App Runner service

Create an App Runner service from the ECR image and set port `3000`. Configure
these environment values through Secrets Manager or App Runner environment
variables; never commit real values:

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
POSTGRES_DATABASE_URL=postgresql://...
WEB_ORIGIN=https://your-domain.example
JWT_SECRET=<random 32+ character secret>
DOCUMENT_ENCRYPTION_KEY=<64 hexadecimal characters>
PAYOUT_ENCRYPTION_KEY=<64 hexadecimal characters>
AWS_REGION=ap-south-1
S3_BUCKET=safar-production-media-<account-id>
S3_PREFIX=safar-media
SANDBOX_ENV=live
SANDBOX_API_KEY=<secret>
SANDBOX_API_SECRET=<secret>
KYC_REDIRECT_URL=https://your-domain.example/kyc.html
BUSINESS_NAME=Safar Self Drive
BUSINESS_LEGAL_NAME=<registered legal name>
BUSINESS_ADDRESS=<registered address>
BUSINESS_PHONE=<support number>
BUSINESS_EMAIL=<support email>
```

Do not set `S3_ENDPOINT` in AWS. The SDK uses the standard AWS endpoint and the
App Runner IAM role. `UPLOAD_DIR` is only for local development and should not
be used as production storage.

## 4. Deploy the PostgreSQL schema before sending traffic

Run migrations from a controlled deployment job or a one-off container with
the production database URL:

```powershell
cd apps/backend
npm ci
$env:POSTGRES_DATABASE_URL = "<use the secret from your deployment shell>"
npm run db:pg:generate
npm run db:pg:deploy
npm run build
```

Do not run `prisma db push` against production. Take an RDS snapshot before
every migration. If the existing SQLite portal has real users or bookings,
perform a separate tested import; the schema migration does not copy data or
local uploads.

Create the first administrator through a one-off task after the migration:

```powershell
npm run admin:create -- --email admin@your-domain.example
```

Use a password manager to generate the password and rotate it after the first
login. Do not paste it into chat or source control.

## 5. DNS, TLS, and checks

Use an App Runner custom domain or CloudFront/Route 53 in front of the service.
Once HTTPS is active, verify:

```text
GET /                  → Safar web portal
GET /api/health        → { "status": "ok" }
POST /api/auth/login   → secure session cookie
GET /api/vehicles      → vehicle search
POST /api/media        → authenticated S3-backed upload
```

Then test a complete staging booking: KYC, vehicle documents, quote, booking
hold, payment record, start-trip evidence, end-trip evidence, agreement PDF,
invoice, cancellation, and admin review. Do not announce production until the
private-object access test proves that another user cannot read a KYC object.

## Recommended initial size

For a small pilot, start with one App Runner service (1 vCPU/2 GB), a small
RDS PostgreSQL instance with automated backups, and S3. Increase App Runner
instances and RDS capacity after observing CPU, database connections, API
latency, and storage growth. Enable CloudWatch logs, alarms, RDS snapshots,
and a monthly AWS budget alert before accepting real payments.
