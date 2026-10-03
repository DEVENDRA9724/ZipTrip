# Cloudflare deployment

The repository contains two deployables:

- `apps/web` is the browser frontend (HTML, CSS, JavaScript and images).
- `apps/backend` is the NestJS API for authentication, vehicles, bookings,
  KYC and admin operations.

The root `wrangler.toml` points Wrangler at `apps/web`. This fixes the
`Could not detect a directory containing static files` error from a root-level
`npx wrangler deploy`.

## Deploy the frontend

From the repository root:

```bash
npx wrangler login
npx wrangler deploy
```

The first command is run once per Cloudflare account. Do not put API tokens,
Sandbox credentials, database passwords or encryption keys in this file or in
the frontend bundle.

## Deploy the API

Wrangler's static asset deployment does not run the NestJS API. Deploy
`apps/backend` to a Node-compatible service such as AWS App Runner, ECS/EC2,
or another managed Node host. Configure these values on that service, not in
the frontend:

- `DATABASE_URL` (managed PostgreSQL in production)
- `JWT_SECRET`
- `WEB_ORIGIN`
- `DOCUMENT_ENCRYPTION_KEY`
- Sandbox/DigiLocker credentials
- object-storage credentials for private KYC and vehicle uploads

Use a private S3 bucket (or an equivalent object store) for KYC files and
vehicle images. Serve short-lived signed URLs after authorization; do not
commit uploads or `.env` files to Git.

## Connect the frontend to the API

The current frontend calls `/api/...` on its own origin. Production routing
must therefore send `/api/*` to the deployed NestJS service through a
Cloudflare Worker/proxy or a reverse proxy in front of both services. A
frontend-only deployment will render pages, but sign-in, bookings, uploads,
KYC and admin actions will fail until this route exists.

Before announcing the site as live, verify:

1. `GET /` returns the frontend.
2. `GET /api/health` (or the configured health endpoint) reaches NestJS.
3. Sign-in, a vehicle search, a booking hold, a private upload URL, and an
   admin-only request all work over HTTPS.
4. CORS, cookies, TLS, database migrations, backups, logging and rate limits
   are configured for the production domain.
