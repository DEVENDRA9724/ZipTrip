# Local Development Database: Backup, Schema Update and Restore

| | |
|---|---|
| Scope | **Local development only.** This procedure never applies to PostgreSQL, RDS or production; the scripts refuse those targets. |
| Performed | 2026-10-11 (Phase 5): Phase 4 payout schema applied after a verified backup. 2026-10-11 (Phase 6): vehicle approval schema, backfill and Option A relabel applied after a verified backup. Re-verified 2026-10-12 (Phase 8). |

## 1. Target identification (performed)

| Check | Result |
|---|---|
| `apps/backend/.env` `DATABASE_URL` | `file:./portal.db` (SQLite). No `postgres://` URL in `.env` or the shell environment; `NODE_ENV` unset. |
| Resolution | Relative to `apps/backend`: the API is started from `apps/backend` with `--env-file .env`, and `prisma.config.ts` reads the same variable. |
| Database files under the repository | Exactly one: `apps/backend/portal.db` (286,720 bytes before the update). |
| Running server | PID on :3000 ran `node --env-file-if-exists=.env dist/main.js` from `apps/backend`. It was stopped before the backup and the schema update. |
| Production configuration on this machine | None. Production must use PostgreSQL; `PrismaService` refuses SQLite when `NODE_ENV=production`. |

## 2. Backup (performed)

```bash
npm --prefix apps/backend run db:backup     # node scripts/sqlite-backup.cjs
```

- **How it works:** the script refuses PostgreSQL URLs, `NODE_ENV=production` and non-file URLs. It uses SQLite's online backup API, then checks the copy with `PRAGMA integrity_check` and compares every table's row count with the source.
- **Backup taken:** `apps/backend/backups/portal-2026-10-11T10-14-15-025Z.db` (gitignored).
  - integrity `ok`, 17 tables;
  - sha256 prefix `6323398f70cdef2e`;
  - rows: User 3, Vehicle 6, Document 20, Media 48, Wallet 3; every other table 0, including Booking, Payout and PayoutAccount.
- **Restore rehearsal:** the backup was copied to a temporary folder and opened. Integrity `ok`, and row counts and schema identical to the live database.

## 3. Schema update (performed)

```bash
DATABASE_URL="file:E:/Andrew Projects/ZipTrip/apps/backend/portal.db" npx --prefix apps/backend prisma db push
```

- **Absolute path:** used so the target is unambiguous.
- **No `--accept-data-loss`:** Prisma would refuse any destructive change. The output was "Your database is now in sync with your Prisma schema", with no data-loss prompt.

**Verification after the update:**
- `PRAGMA integrity_check`: `ok`.
- Row counts are identical to the backup for all 17 tables.
- User, Vehicle, Document, Media, Booking and Wallet rows are byte-for-byte identical to the backup.
- `Payout` and `PayoutAccount` columns and indexes exactly match `test/fixtures/sqlite-schema.sql`, the schema used by the integration tests.
- Payouts with a destination snapshot: 0. Payout accounts: 0. **No legacy destination exists to infer, and none was inferred.**

The dev server was restarted on the new build. `GET /api/payouts`, `/api/payouts/accounts` and `/api/admin` returned 200 for the admin session.

## 4. Restore procedure

1. Stop the API: Ctrl+C in its terminal, or stop the process listening on :3000.
2. Keep the current file: `copy apps\backend\portal.db apps\backend\portal.before-restore.db`.
3. Copy the chosen backup over it: `copy apps\backend\backups\portal-<timestamp>.db apps\backend\portal.db`.
4. Delete any `portal.db-wal` and `portal.db-shm` files left beside it. The backup is a complete database.
5. If the restored file predates the current schema, run `npm --prefix apps/backend run db:push` again (additive, see §3), or use the previous build.
6. **If the restored file predates Phase 6** (any backup older than `portal-2026-10-11T11-47-30-644Z.db` included), also run, in this order:
   - `npm --prefix apps/backend run db:backfill-vehicles`
   - `npm --prefix apps/backend run db:relabel-demo-documents`

   Both are idempotent and print masked ids only. The relabel aborts without changes unless exactly the 20 known records match (§5).
7. Start the API and check `GET /api` and a signed-in `GET /api/auth/profile`.

## 5. Phase 6–8 data state and checks

| Backup | Taken | State |
|---|---|---|
| `portal-2026-10-11T11-47-30-644Z.db` (and an identical `…11-47-36-505Z.db`) | Phase 6, before the vehicle migration | Pre-migration. **Restoring it undoes the backfill and the Option A relabel.** |
| `portal-2026-10-11T12-21-17-971Z.db` | Phase 7 | Current state. Restore rehearsed: identical to the live file, all checks pass. |

**Expected state** (verified in Phases 7 and 8 against the live file; read-only):
- 6 vehicles, all `PENDING_APPROVAL` / `INACTIVE` / `REVIEW_REQUIRED`, with no approver, and **none publicly bookable** (`GET /api/vehicles` returns `[]`).
- 20 documents, all `APPROVED` with source `DEMO_SEED`, **no evidence file**, and an "unverified" review note. No evidence was created.
- The demo customer is unverified, with no DL validity.
- Exactly one `VEHICLE_STATUS_BACKFILLED` audit row per vehicle, one `DOCUMENT_RELABELLED_DEMO` row per document, and one `USER_VERIFICATION_RECOMPUTED` row.
- Media, Wallet and User rows other than the customer's verification fields are unchanged. There are no bookings or payments.

**Git hygiene.** `portal.db`, `apps/backend/backups/` and `.env` are gitignored (`apps/backend/.gitignore`), and none is tracked. `repository-secrets.spec.ts` fails if a database, key or `.env` file is ever tracked.

## 6. PostgreSQL / production (not performed)

Use the versioned migrations (`npm --prefix apps/backend run db:pg:deploy`) only after a `pg_dump -Fc` and an RDS snapshot, following `docs/PAYOUT_BANK_ACCOUNT_POLICY.md` §6. `npm --prefix apps/backend run db:verify-migrations` rehearses the full migration chain on disposable PGlite and SQLite databases.
