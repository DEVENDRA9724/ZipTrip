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

The server output confirms `safar-portal.service` is running under systemd, with Node 22 installed. The original `/home/ubuntu/ZipTrip` directory is not a Git checkout. Use the new clone:

```bash
cd /home/ubuntu/ZipTrip-login-fix
git status --short
git pull --ff-only
bash scripts/linux-update.sh
```

The helper first checks for `safar-portal.service`. For systemd it reads the existing service's WorkingDirectory, backs up the existing code (excluding secrets/data/dependencies), and syncs the new source there without overwriting `.env`, databases, uploads, or Git metadata. It installs dependencies and compiles in that existing directory, then restarts the same service. This avoids installing another dependency tree in the clone. An unrecognized service directory stops the update. PM2 is used only when the systemd service does not exist. Keep the existing `.env` and database. Review prerequisites below before running it. The database backup ZIP is separate and is not committed to GitHub.

## 1. Upload the source ZIP (alternative to Git)

Download `safar-linux-source.zip` to the same folder as your terminal. In PowerShell on your own computer, use the existing EC2 key (replace the example key path):

```powershell
scp -i "C:\path\to\zip-trip-key.pem" .\safar-linux-source.zip ubuntu@13.202.48.156:~/
ssh -i "C:\path\to\zip-trip-key.pem" ubuntu@13.202.48.156
```

The source ZIP includes the full application source, lockfiles, database schemas/migrations, tests and templates. It excludes `.git`, dependencies, generated backend builds, `.env`, databases, uploaded private files and logs. Install dependencies on Linux; do not copy Windows `node_modules`.

## 2. Back up and update the existing checkout

These alternative ZIP commands use `/home/ubuntu/ZipTrip`, the path in this project's existing deployment scripts. If your app lives elsewhere, use that actual path throughout. Run as the Ubuntu account that owns the installation, with sudo permission to restart its systemd service (or as the account that owns its PM2 process).

```bash
sudo apt-get update
sudo apt-get install -y unzip rsync build-essential python3
node --version  # must be 22 or newer
systemctl status safar-portal.service --no-pager

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

The update script requires your already-configured PostgreSQL connection, JWT secret, private S3 bucket and document encryption key. Preserve these values, especially the encryption key used for existing documents. If you use `POSTGRES_DATABASE_URL`, keep `DATABASE_URL` pointed at the same PostgreSQL database for the maintenance scripts. The script does not run migrations, create accounts, reset passwords, import the local database, or change Nginx configuration. It copies web files to `/var/www/safar` only if that directory already exists, restarts Safar through systemd or PM2, then checks the API on port 3000. For systemd startup errors use `sudo journalctl -u safar-portal.service -n 60 --no-pager`; for PM2 use `pm2 logs safar-portal --lines 60 --nostream`. If your service name or API port differs, adjust the helper before running it.

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

### Existing administrator password recovery

When the deployed page loads but the configured administrator's password is rejected, an operator with SSH access can reset only that existing active administrator's password. This does not import local accounts, change roles, unblock accounts, or alter verification. The command checks the same PostgreSQL URL precedence as the API and writes a password-reset audit record in the same transaction. Passwords are entered twice with hidden terminal input and are never supplied through command arguments. Existing sessions are not revoked by this command; no server restart is needed for the new password to work.

For the confirmed server layout, pull the branch and copy just the maintenance script into the existing installation:

```bash
cd /home/ubuntu/ZipTrip-login-fix
git pull --ff-only
install -m 644 apps/backend/scripts/reset-admin-password.cjs \
  /home/ubuntu/ZipTrip/apps/backend/scripts/reset-admin-password.cjs
cd /home/ubuntu/ZipTrip/apps/backend
NODE_ENV=production node --env-file=.env scripts/reset-admin-password.cjs
```

If the account does not exist, the script makes no changes. Use `NODE_ENV=production npm run admin:create` from that backend directory to create an administrator using the existing interactive command. Do not post passwords, `.env` contents, or private passwords files in chat.

### Backup contents

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

## Restore the previous 13-car fleet into the existing server

The owner confirmed that the 13 cars in the previous local backup are the missing listings. The private `safar-13-car-restore.zip` package contains only those fleet records, their owner reference, model/hub specifications, 104 public vehicle photos and 39 vehicle-document record stubs. It excludes account password hashes, OTP data and private identity documents. The code is on `fix/remove-demo-controls-linux`; the data ZIP is deliberately outside GitHub.

This restores listings in the administrator's vehicle list without changing existing account passwords, roles, or existing vehicles. Source owners are matched by email; if the previous host does not exist, a host account is created with a random password written to a server-local file with mode 600. Existing registration numbers/vehicle IDs are skipped. Models are reused by their unique specification. Photos go to the configured S3 bucket and are read back and checked. Existing S3 objects with different content are never overwritten. A database error rolls back the new database records together; verified S3 uploads can be reused on retry.

The old 39 RC/Insurance/PUC entries have no evidence attachments. They are restored as pending, and all restored cars are pending approval and inactive. The admin must upload actual document evidence, review it, approve each car, and activate availability before customer booking. Importing old ACTIVE labels alone cannot satisfy the current booking criteria. Actual source S3 credentials and encryption keys are not included or changed. No old customer bookings/payments are imported by this fleet-only tool.

Upload the ZIP into `/home/ubuntu/` using your existing EC2 SSH key. From Windows PowerShell (replace the key path):

```powershell
scp -i "C:\path\to\zip-trip-key.pem" `
  "C:\Users\My Buddy\Downloads\ZipTrip-main\releases\safar-linux-20261029\safar-13-car-restore.zip" `
  ubuntu@13.202.48.156:/home/ubuntu/
```

Then run on Ubuntu:

```bash
sudo apt-get install -y unzip
umask 077
mkdir -p /home/ubuntu/safar-fleet-restore
unzip -n /home/ubuntu/safar-13-car-restore.zip -d /home/ubuntu/safar-fleet-restore

cd /home/ubuntu/ZipTrip-login-fix
git pull --ff-only && bash scripts/linux-update.sh

cd /home/ubuntu/ZipTrip/apps/backend
# Read-only check, including all source photo checksums:
NODE_ENV=production node --env-file=.env scripts/restore-fleet.cjs \
  /home/ubuntu/safar-fleet-restore/fleet-restore
# Restore missing cars/photos; preserve existing records:
NODE_ENV=production node --env-file=.env scripts/restore-fleet.cjs \
  /home/ubuntu/safar-fleet-restore/fleet-restore --apply
```

Check the returned `restoredVehicles` count (13 on a previously empty fleet), then refresh `admin.html?tab=vehicles`. Newly inserted records are visible immediately without another server restart. Keep the owner credentials file private. If the restore fails, share its summary/failure code, not `.env` contents or passwords. Dry-run and apply do not seed or replace the production database. Back up the production PostgreSQL database with your existing backup tooling before any data migration.

Validation: 10 restore checks cover dry runs, existing login preservation, model/owner matching, duplicate prevention, damaged photos, S3 conflicts, and transaction failure; the full 13-car package was restored in a throwaway Prisma/SQLite database with 104 photo records and 39 pending document records. A rerun left all existing records unchanged. Four browser tests cover empty fleet/search messaging and filtering values outside presets. PostgreSQL/S3 execution must still be verified on the actual server.

## Fresh installation prerequisites

The update commands assume an existing working Safar server. For a fresh installation, first provision PostgreSQL, private S3 access, SMS and other required providers, and configure `apps/backend/.env` from `.env.example`. Use reviewed PostgreSQL migrations (`npm run db:pg:deploy`) against the intended database, then the update helper and administrator creation. See `AWS-DEPLOYMENT.md`, `docs/MEDIA_STORAGE.md`, and `docs/MSG91-OTP-SETUP.md`. No real `.env`, AWS key, JWT secret or document key is supplied in this archive.
