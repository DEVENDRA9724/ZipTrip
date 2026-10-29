# Safar Linux update — 29 October 2026

Target supplied by owner: Ubuntu EC2, `ubuntu@13.202.48.156`.

## What changed

- Removed the three public demo account/password buttons and their autofill code.
- Removed the delivery, FASTag, S3-inspection and host-rating checkboxes that did not filter anything.
- Kept functional search, budget, vehicle, transmission, fuel and customer-rating filters.
- Confirmed real password login for admin, host and customer, including cookie-only sessions after reload.
- Added `scripts/linux-update.sh` for updating an existing configured installation without seeding or replacing data.

Validation: backend TypeScript build succeeded; all 14 authentication/browser checks passed. Linux script passed `bash -n`. Deployment on your server has not been performed.

## Deploy from the new Git branch

For the GitHub branch version, use the existing configured checkout on your server:

```bash
cd /home/ubuntu/ZipTrip
git status --short
# Resolve or back up local source changes before switching branches; do not reset them.
git fetch origin
git switch --track origin/fix/remove-demo-controls-linux
bash scripts/linux-update.sh
```

If that branch already exists locally, use `git switch fix/remove-demo-controls-linux` then `git pull --ff-only`. The helper installs Linux dependencies, generates the PostgreSQL client, builds the backend, updates an existing Nginx static web directory, and restarts PM2. Keep the existing `.env` and database. Review the backup and prerequisites below before running it. The database backup ZIP is separate and is not committed to GitHub.

## 1. Upload the source ZIP (alternative to Git)

Download `safar-linux-source.zip` to the same folder as your terminal. In PowerShell on your own computer, use the existing EC2 key (replace the example key path):

```powershell
scp -i "C:\path\to\zip-trip-key.pem" .\safar-linux-source.zip ubuntu@13.202.48.156:~/
ssh -i "C:\path\to\zip-trip-key.pem" ubuntu@13.202.48.156
```

The source ZIP includes the full application source, lockfiles, database schemas/migrations, tests and templates. It excludes `.git`, dependencies, generated backend builds, `.env`, databases, uploaded private files and logs. Install dependencies on Linux; do not copy Windows `node_modules`.

## 2. Back up and update the existing checkout

These commands use `/home/ubuntu/ZipTrip`, the path in this project's existing deployment scripts. If your app lives elsewhere, use that actual path throughout. Run as the same Ubuntu account that owns the current PM2 service.

```bash
sudo apt-get update
sudo apt-get install -y unzip rsync build-essential python3
node --version  # must be 22 or newer
pm2 status

cd /home/ubuntu
test -f ZipTrip/apps/backend/.env || { echo 'Use your actual app directory; existing .env not found'; exit 1; }
stamp=$(date +%Y%m%d-%H%M%S)
umask 077
tar --exclude=ZipTrip/.git --exclude='*/node_modules' \
    -czf "safar-before-update-$stamp.tar.gz" ZipTrip

mkdir "safar-release-$stamp"
unzip -q safar-linux-source.zip -d "safar-release-$stamp"
rsync -a "safar-release-$stamp/ZipTrip/" /home/ubuntu/ZipTrip/
cd /home/ubuntu/ZipTrip
bash scripts/linux-update.sh
curl --fail http://127.0.0.1:3000/api/health
```

The ZIP contains no `.env` or database and rsync does not use `--delete`, so the server's current settings/data remain in place. Before any database migration, also take a PostgreSQL backup with your existing database backup tooling; the checkout archive above is a code/config backup, not a PostgreSQL backup.

The update script requires your already-configured PostgreSQL connection, JWT secret, private S3 bucket and document encryption key. Preserve these values, especially the encryption key used for existing documents. If you use `POSTGRES_DATABASE_URL`, keep `DATABASE_URL` pointed at the same PostgreSQL database for the maintenance scripts. The script does not run migrations, create accounts, reset passwords, import the local database, or change Nginx configuration. It copies web files to `/var/www/safar` only if that directory already exists, restarts `safar-portal`, then checks the API on port 3000. Use `pm2 logs safar-portal --lines 60 --nostream` if startup fails. If your service name or API port differs, adjust the helper before running it.

Do not run the older `deploy.sh`/`rebuild.sh` for this update: those scripts reset the branch, run `db push --accept-data-loss` and seed demonstration data outside production mode. This package's update helper avoids those steps. Check existing cron/automation jobs before using the package so an old auto-deploy does not replace your update from a different branch.

## 3. Sign in

Open `http://13.202.48.156/auth.html` and refresh. Enter an account/password actually configured in the server's PostgreSQL database. Removing demo buttons does not create accounts or make a local SQLite password valid in PostgreSQL.

The local backup contains the sample admin account shown in the screenshot; this does not establish what credentials the live server uses. The existing `import-data-export.cjs` assigns new random passwords during import. If it was previously run, use the private passwords file it wrote rather than the old demo passwords. Mobile OTP also requires the server's configured SMS provider.

If no administrator exists yet, the existing script creates a new account using an interactive email/password prompt (it refuses to alter an existing account):

```bash
cd /home/ubuntu/ZipTrip/apps/backend
NODE_ENV=production npm run admin:create
```

## 4. Database backup package

`safar-local-database.zip` is a separate private backup, not part of the code deployment. It contains `portal.db`, its SHA-256/check/count manifest, and available local media files. SQLite integrity check passed and all 23 table counts matched the source. This is the complete local database snapshot, not the live PostgreSQL database.

You can transfer it to the server home directory for private staging:

```powershell
scp -i "C:\path\to\zip-trip-key.pem" .\safar-local-database.zip ubuntu@13.202.48.156:~/
```

On Linux, keep it outside `/var/www/safar` and `apps/web`:

```bash
umask 077
mkdir -p ~/safar-private-backup
unzip -n ~/safar-local-database.zip -d ~/safar-private-backup
chmod -R go-rwx ~/safar-private-backup
```

The production app requires PostgreSQL. Do not copy `portal.db` over a PostgreSQL database, change the server to development mode, or overwrite live data to resolve a login error. A full transfer needs a separate PostgreSQL migration/import with a live backup and record/media verification. The included existing JSON import script is limited to selected account/fleet tables and an empty target database; it is not a full 23-table restore and cannot read this SQLite file directly. It intentionally resets passwords, customer verification and vehicle approval during production import.

Private document files also require the original document encryption key for re-encryption into the server's S3 storage. That key is deliberately not included. Uploading the backup ZIP alone does not make those files accessible to the production app.

## Fresh installation

The update commands assume an existing working Safar server. For a fresh installation, first provision PostgreSQL, private S3 access, SMS and other required providers, and configure `apps/backend/.env` from `.env.example`. Use reviewed PostgreSQL migrations (`npm run db:pg:deploy`) against the intended database, then the update helper and administrator creation. See `AWS-DEPLOYMENT.md`, `docs/MEDIA_STORAGE.md`, and `docs/MSG91-OTP-SETUP.md`. No real `.env`, AWS key, JWT secret or document key is supplied in this archive.
