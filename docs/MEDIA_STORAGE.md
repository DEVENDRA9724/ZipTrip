# Media storage (S3 only)

Every uploaded file (car photos, RC/Insurance/PUC, DL and DigiLocker originals) is stored in a **private S3 bucket**.
Nothing is written to or read from the server's disk.

## How it works

- **Upload** (`POST /api/media`, KYC documents):
  1. sharp checks each image and re-encodes it as JPEG.
  2. Private documents (RC, INSURANCE, PUC, DL, AADHAAR) are also encrypted by the app with AES-256-GCM (`DOCUMENT_ENCRYPTION_KEY`).
  3. The result is written to `s3://$S3_BUCKET/$S3_PREFIX<storageKey>`.
- **View and download** (`GET /api/media/:id`, optional `?download=1`):
  1. The API checks who may see the file.
  2. It fetches the object from S3, decrypts it if it is private, and sends it back.
  - The bucket is never public, and the browser never talks to S3 directly, so the Content-Security-Policy is unchanged.
- **Errors:**
  - A missing object returns `404 Image not found`.
  - S3 being down returns `503 File storage is temporarily unavailable`. Only the error name is logged.
- **Code:** `apps/backend/src/media/object-storage.ts`. Maintenance scripts use `apps/backend/scripts/s3-storage.cjs`, which reads the same settings.
- **Tests:** they use an in-memory store (`MEDIA_STORAGE=memory`). The server refuses that store when `NODE_ENV=production`.

## Settings (`apps/backend/.env`)

| Variable | Notes |
| --- | --- |
| `S3_BUCKET` | Required. In production the API will not start without it. |
| `S3_REGION` | Defaults to `AWS_REGION`, then `ap-south-1`. |
| `S3_PREFIX` | Key prefix. Default `media/`. |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true` | Only for an S3-compatible emulator. Leave both empty on AWS. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Optional on AWS, where an EC2 instance role is preferred. |
| `S3_SERVER_SIDE_ENCRYPTION` | Optional, AWS only: `AES256` or `aws:kms`. |

## Local development (S3 emulator)

Docker is not available on this machine, and MinIO no longer publishes downloadable binaries. Local development
therefore uses **rclone `serve s3`**: rclone v1.75.2, downloaded from downloads.rclone.org and checked against the
published SHA-256 checksum.

**Where it lives:** `C:/Users/khushboo/tools/rclone/`, outside the repository.
- Objects are stored in `data/<bucket>/<prefix>`.
- The `.env` already has `S3_ENDPOINT=http://127.0.0.1:9000`, `S3_FORCE_PATH_STYLE=true`, the bucket name, and randomly generated local credentials.

**Start the emulator** before the API, in each session:

```sh
node C:/Users/khushboo/tools/rclone/start-local-s3.cjs
```

The launcher reads the credentials from `apps/backend/.env` and passes them to rclone through the environment, so
they never appear on the command line. The emulator listens on 127.0.0.1 only and refuses anonymous requests.

If the emulator is not running, images in the portal fail with a 503. They do not fall back to the disk.

## Moving existing local files to S3

Files uploaded before 2026-10-20 sat in `apps/backend/uploads/`. To copy them into the bucket:

```sh
cd apps/backend
npm run db:backup             # database backup first
npm run media:migrate-to-s3   # copy and verify each file
npm run media:verify-s3       # re-check only; writes nothing
```

- **Copy and verify:** each file is uploaded, read back, and compared by SHA-256.
- **Safe to repeat:** objects that are already identical are skipped.
- **Read-only on local data:** the script never deletes or changes local files, and only reads the database.
- **Reports:** missing files, mismatches and unsafe keys are listed with masked IDs. The exit code is non-zero when anything did not verify.

On 2026-10-20 all 49 local files were migrated and verified (49/49). `apps/backend/uploads/` was kept as a backup and
is git-ignored. The app no longer reads it, so it can be archived or removed by the owner once S3 is trusted.

## Switching to a real AWS bucket

1. Create a private bucket:
   - Block Public Access on.
   - Bucket-owner-enforced ownership.
   - Default encryption.
   - Optional: versioning.
2. Give the EC2 instance role `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/media/*`, plus `s3:ListBucket` on the bucket (this makes missing keys return 404).
3. In `.env`:
   - Set `S3_BUCKET` and `S3_REGION`.
   - Remove `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` and the access keys.
4. Run `npm run media:migrate-to-s3` against the old storage. If the files are already in the emulator, copy them across with `rclone copy`. Then run `npm run media:verify-s3`.
