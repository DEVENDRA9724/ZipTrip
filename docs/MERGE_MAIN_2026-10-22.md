# Merge of `origin/main` into `new-change`, 22 Oct 2026

The merge is on branch **`merge-main-new-change`**. Its parents are:
- `new-change` (191d62a): S3-only media, role-based menus, vehicle compliance, demo mode;
- `origin/main` (b4c2914): 44 commits covering the UI redesign, MSG91 OTP, settlements, deploy scripts and the committed `dist/`.

**Rule applied (owner's decision):** keep main's features and screens, but keep the existing verification, payment and storage rules. Where a main change bypassed those rules, the feature stays and the bypass is closed.

## Kept from main

- **Design and pages:**
  - the full portal redesign: design system, new home, cars, car detail and account pages;
  - the dark-free theme and the KPI ribbons.
- **Owner panel:** the guided 8-angle camera walkaround for listing a car.
- **Customer account:** the disputes, reviews, history and saved/alerts sections.
- **Admin sections:**
  - approvals, disputes, pricing, reports;
  - booking swap, cancel and settle;
  - password reset;
  - vehicle history.
- **Backend:**
  - MSG91 OTP login;
  - rental state machine and settlements;
  - Razorpay checkout and the signed webhook;
  - notifications, hubs and model specs.
- **Deployment:** the deploy scripts and a committed `dist/`, which has been rebuilt from the merged source.

## Kept from new-change

- **Header menus by role:**
  - admin sections with counts;
  - owner tasks;
  - customer tasks (each account section is its own page).

  Main's second sidebar menus were dropped so that no page shows the same menu twice.
- **Media storage:** S3-only storage served through `/api/media` with access checks. See `MEDIA_STORAGE.md`.
- **Car approval:** approved, evidenced, unexpired RC, Insurance and PUC; another admin must review; the demo-mode rules.
- **Payout destination snapshots:** the second-admin rule for bank details.
- **Strict security policy:** no inline scripts. All of main's inline `onclick` and `onerror` attributes were converted to event listeners.

## Changed in main's code during the merge

| Main behaviour | Now |
| --- | --- |
| `main.ts` silently used a hardcoded `JWT_SECRET` when none was set. | It refuses to start without a real secret. **The hardcoded value is public on GitHub: rotate the secret on any server that used it.** |
| `PrismaService` loaded `.env` on import with `override: true`, and fell back to `root:rootpassword@127.0.0.1`. | The environment is read only once, in `main.ts`, without overriding. There are no built-in credentials, and production requires PostgreSQL. (The old behaviour let tests run against the developer's real database.) |
| Media fell back to the local disk when S3 failed. Any HOST or DEALER could read any private document. | Storage is S3 only. Private documents are visible only to their owner or an admin. Old `safar-media/...` keys still resolve, but set `S3_PREFIX=safar-media` on servers that used them. |
| The "face match" score was derived from the selfie's hash, auto-verified the user and approved Aadhaar and DL. | The submission is queued as **pending** documents for admin review. No score is invented. Document images must be the user's own uploads. |
| Admin "Approve e-KYC" approved all of a user's documents, car documents included, with an invented 2029 expiry. | It only revokes, or re-checks verification from documents that are already approved. |
| Admin "quick review" skipped the evidence check and invented a 3-year expiry. | It runs the normal review: evidence viewed, expiry entered, no demo or test records. |
| Admin car activation needed no documents and auto-approved pending ones. | Approval requires compliant documents (the new-change admin review). |
| `POST /bookings/:id/pay` let any customer mark their own booking paid and confirmed, even in production. | It works only when `NODE_ENV` is `development` or `test`. Real payments go through the signed webhook. |
| OTP code `123456`, and OTPs shown on screen and in logs, whenever `NODE_ENV` was not exactly `production`. | Only when `NODE_ENV` is `development` or `test`. `deploy.sh` does not set `NODE_ENV`, so these are off there. |
| The webhook treated every non-failure event (including refunds) as a successful payment. | Only explicit success events (captured, paid, success, authorized) confirm a booking. Other events are ignored. |
| The session cookie was `secure` only when `x-forwarded-proto` was exactly `https`. | It is also secure when the first forwarded protocol is `https` or when `WEB_ORIGIN` is HTTPS. |
| `seed.js` wrote demo accounts and "DigiLocker verified" documents into production on every deploy. | In production it skips with exit code 0, so `deploy.sh` still works. Elsewhere the demo records are labelled `DEMO_SEED`. |
| Handover photos could be any media id, could be reused, and pickup could happen before the rental period. | Photos must be the submitter's own unused uploads, and pickup happens within the booked period. |
| The car page showed invented distances, a fixed ₹2,000 deposit, "free cancellation 24 h", an unlimited-km add-on that cannot be bought, a placeholder phone and a hub address. | The page shows the real policy values from the server (deposit, km, excess rate, the 48h / 24–48h / <24h refund rule). Contact details come from `BUSINESS_*`. |
| The rental agreement checkbox was pre-ticked. | The customer must tick it. |
| The selfie step submitted a generated portrait when no selfie had been taken. | A real selfie is required. The generated one is available only in local demo mode. |

## Before merging to `main` / deploying

1. **Rotate secrets:** rotate `JWT_SECRET` (and any other value that was committed) on every server.
   - `scripts/aws-setup.sh` (from main) creates the production PostgreSQL user with the published password `rootpassword`. Change that password on the server and in `DATABASE_URL`. The script is unchanged in this merge.
2. **Back up the database first.** `deploy.sh` runs `prisma db push --accept-data-loss`.
3. **Vehicle approval and availability:** the merged schema adds `approvalStatus`, `availability` and related columns with conservative defaults (DRAFT / INACTIVE). Back-fill them before going live, or every car disappears from the listings. For PostgreSQL use the migration in `prisma/postgresql/migrations/202610110002_vehicle_approval_availability`; locally use `npm run db:backfill-vehicles`.
4. **S3 settings:** set `S3_BUCKET`, `S3_REGION` and `S3_PREFIX=safar-media` (to keep existing objects readable). Copy any files that were saved to the server's disk with `npm run media:migrate-to-s3`.
5. **Environment:** do not set `NODE_ENV=development` on a public server.
6. **Lint:** the main-side code adds lint findings (about 700) that were not reformatted during the merge.

## Verification

- **Backend:** Jest, 30 suites / 184 tests, passing.
- **Browser:** Playwright, 55 tests, passing, including the CSP test (no violations on customer, owner and admin pages).
- **Secrets:** the repository secret scan passes.
- **Build:** `dist/` was rebuilt from the merged source and contains no hardcoded secret or credentials.
