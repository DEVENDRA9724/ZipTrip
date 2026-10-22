# Local demo verification mode

**`DEMO_VERIFICATION=true`** in `apps/backend/.env` lets the labelled demo records (`source = DEMO_SEED`) count as
verification on a local machine. With it on, a fresh checkout can show verified owners, approved cars and working
bookings without real documents.

## Rules

- **Local only.**
  - It is ignored when `NODE_ENV=production`.
  - The API refuses to start in production if the flag is set.
- **What counts.**
  - Only `DEMO_SEED` records count.
  - Provider test data (`DIGILOCKER_TEST`) never counts.
  - The admin review endpoint still refuses to *approve* demo or test documents.
- **Labelling.** The records are never relabelled as genuine. The portal shows them as:
  - "Demo verified"
  - "Demo record (local demo mode)"
  - "Verified (local demo record)"
- **Turning it off.**
  1. Remove the flag, or set it to anything other than `true`, and restart the API.
  2. Demo records stop counting immediately, so cars that rely on them stop being publicly bookable.
  3. Cars that admins already approved keep `approvalStatus = APPROVED`. Re-review them, or revoke them, before showing real users.

## Completing a demo account

```sh
cd apps/backend
npm run db:backup
npm run demo:complete-account -- host@safar.com
```

**What it does:** adds approved `DEMO_SEED` DL and Aadhaar records to the account, then recomputes `isVerified`.
- The DL record is valid for 2 years.
- Each change writes an audit row with the previous values.
- Running it again changes nothing.

**Cars:** approve them through the admin panel or the admin API (`POST /api/admin/vehicles/:id/review` with
`{"decision":"APPROVE"}`, then `POST /api/vehicles/:id/availability`). This keeps the normal checks and audit trail.

## Applied on 2026-10-20

`host@safar.com` was completed:
- verified with demo DL and Aadhaar records;
- all 6 of its cars approved by `admin@safar.com` and set to accept bookings.

Database backup taken first: `apps/backend/backups/portal-2026-10-19T19-10-14-251Z.db`.

The BMW's real pending uploads (RC and Insurance) remain in the review queue.

`customer@safar.com` was completed the same day. It already had demo DL (valid to 2029-12-31) and Aadhaar records, so only its verification was recomputed. Backup: `apps/backend/backups/portal-2026-10-19T20-18-57-110Z.db`.
