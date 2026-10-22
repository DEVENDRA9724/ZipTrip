# ZipTrip / Safar Self Drive — Project Audit & Context (for AI memory)

Audit date: 2026-10-11 · Repo: github.com/DEVENDRA9724/ZipTrip (branch `main`, 16 commits, last 2026-10-09)

## 1. What the product is
- **Safar Self Drive** ("Safar", "Safarcars" on agreements): a self-drive car rental and car-sharing marketplace for Gujarat, India. The repo/folder is named **ZipTrip**, but no user-facing code uses that name.
- **Four roles:** CUSTOMER (renter), HOST (car owner), DEALER (fleet/franchise, same permissions as HOST), ADMIN.
- **Lifecycle:** KYC → vehicle listing and approval → availability search → booking hold → (manual) payment → agreement → pickup inspection → trip → return inspection → settlement → invoice → payout → ratings.
- **Full requirements spec:** `Safar_Portal_Requirements.docx` (repo root). Progress log: `COMPLETION-STATUS.txt`.
- Currency is INR. Money is computed in paise.

## 2. Monorepo layout
```
apps/backend   NestJS 11 API (TypeScript, Prisma 7). Also serves apps/web as static files on :3000
apps/web       Plain HTML/CSS/vanilla-JS portal (no framework, no build step)
apps/mobile    Expo SDK 56 / React Native 0.85 / React 19 / expo-router app
docs/original-web  Old pre-backend prototype (localStorage fake auth). Obsolete, safe to delete
scripts/       Root one-off/test scripts (mostly junk, some leak secrets; see §8)
wrangler.toml  Cloudflare Worker static-assets deploy of apps/web (no /api proxy yet)
docker-compose.yml  Postgres+Redis ("ziptrip_*", root/rootpassword). NOT used by the app
start-portal.js / *.bat  Local launcher (node apps/backend/dist/main.js). stop-portal.js is a no-op
```

## 3. Backend (apps/backend)
- **Stack:** NestJS 11, Prisma ^7.8 with driver adapters (better-sqlite3 for dev, pg for prod), `@nestjs/jwt`, bcryptjs, multer, sharp, Jest 30.
- **Database:**
  - Dev uses SQLite (`DATABASE_URL=file:./portal.db`, `prisma db push`). Production refuses to start on SQLite.
  - `prisma/schema.prisma` is the source of truth. `prisma/postgresql/schema.prisma` is generated from it by `scripts/prepare-postgres.js`, which only swaps the provider line.
  - Postgres has 7 migrations in `prisma/postgresql/migrations`.
- **Auth:** HS256 JWT valid 8h, sent in the HttpOnly cookie `safar_session` (web) or a Bearer header (mobile). The token is also returned in the body for mobile. There is no refresh token and no revocation.
- **Role checks:** done inline in handlers (e.g. `admin()` helper). There are no Nest role guards.
- **Storage:** private S3 bucket only (`S3_*` settings; local development uses an S3 emulator), served through `/api/media` after access checks — see `docs/MEDIA_STORAGE.md` (changed 2026-10-20; previously local disk `UPLOAD_DIR`). Images are re-encoded via sharp. KYC docs and DigiLocker originals are encrypted with AES-256-GCM (`DOCUMENT_ENCRYPTION_KEY`, 64 hex chars). Bank account numbers are encrypted too (`PAYOUT_ENCRYPTION_KEY`).
- **KYC provider:** Sandbox.co.in API wrapping DigiLocker (Aadhaar + driving licence). Admin approval requires viewing the evidence within the last 15 minutes. `isVerified` = approved and unexpired DL + approved AADHAAR. DIGILOCKER_TEST docs can never be approved.
- **Agreement PDF:** spawns Python. `scripts/populate_agreement.py` (python-docx) fills `templates/Safarcars_Car_Sharing_Agreement.docx`. Conversion tries LibreOffice `soffice`, then falls back to ReportLab. The host needs Python installed.
- **Prisma models:** User, Vehicle, AvailabilityBlock, Booking, Payment, Invoice, Media, Document, KycSession, Inspection (PICKUP/RETURN/DAMAGE), AuditLog, Review (vehicle), PartyRating (customer↔host), Wallet, Notification, PayoutAccount, Payout.
- **Enums:**
  - `Role`: CUSTOMER, HOST, DEALER, ADMIN
  - `BookingStatus`: PENDING, CONFIRMED, ACTIVE, COMPLETED, CANCELLED
  - `VehicleStatus`: PENDING_APPROVAL, ACTIVE, INACTIVE, MAINTENANCE
- **API modules** (all under `/api`):
  - **auth:** register, login, logout, profile
  - **account:** role dashboard
  - **vehicles:** search, mine, detail, quote, schedule, host-agreement, availability-blocks, create
  - **bookings:** create hold, my-trips, host-bookings, agreement / pdf / acknowledge, cancel, inspection
  - **invoices**
  - **media:** upload, get
  - **kyc:** documents, sessions, sync, evidence, certificate
  - **admin:** overview, doc review, direct vehicle create, vehicle review/pricing, manual payment, hold extend/release, refund, settlement preview, user block, `export.csv`
  - **payouts:** bank account and manual payout ledger
  - **reviews:** vehicle + party
  - **notifications**
  - **wallet:** balance only; deposit always returns 403
- **Business rules** (`bookings/pricing.ts`, `rental-policy.ts`; overridable via env):
  - Each started 24h counts as one rental day.
  - Distance: 300 km included per 24h (prorated); excess ₹10/km.
  - Deposit: ₹2,000.
  - Late return: 30-minute grace, then ₹500/h.
  - Cancellation: 100% refund if >48h before pickup, 50% at 24–48h, 0% under 24h. This is only displayed; it is never applied.
  - Booking hold lasts 30 minutes. `requestKey` is the idempotency key and is required.
  - Overlap check covers CONFIRMED and ACTIVE bookings, unexpired PENDING holds, and availability blocks. RC, insurance and PUC must be valid through the return date.
- **Booking flow today:**
  1. PENDING hold.
  2. **Admin records an offline payment**, which moves the booking to CONFIRMED and creates the Payment and Invoice. There is NO payment gateway.
  3. PICKUP inspection → ACTIVE.
  4. RETURN inspection → COMPLETED.
  5. Admin settlement preview.
  6. Manual payouts.
- **Env vars:**
  - Required: `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `DOCUMENT_ENCRYPTION_KEY`.
  - Optional: `PORT`, `WEB_ORIGIN`, `S3_*` (`S3_BUCKET` required in production), `PAYOUT_ENCRYPTION_KEY`, `SANDBOX_ENV`/`SANDBOX_API_KEY`/`SANDBOX_API_SECRET`, `KYC_REDIRECT_URL`, `BUSINESS_*`, `AGREEMENT_PYTHON`/`AGREEMENT_SOFFICE`/`AGREEMENT_DOCX_RENDERER`, policy overrides (`DEFAULT_SECURITY_DEPOSIT`, `INCLUDED_KM_PER_24_HOURS`, `EXCESS_KM_RATE`, `LATE_RETURN_GRACE_MINUTES`, `LATE_RETURN_RATE_PER_HOUR`).
- **Run:**
  - Easiest: from the repo root, `npm run setup` (writes `.env` with random keys, installs, `db push`, seeds, builds), then `npm start`. This serves http://localhost:3000.
  - Or, in `apps/backend`: `npm run db:generate && npm run db:push && npm run seed && npm run start:dev`.
  - Seed users: admin@safar.com / Admin@12345678, host@safar.com / Host@12345678, customer@safar.com / Customer@12345678.
- **Tests:** 7 Jest specs covering pricing, availability, the availability integration test (SQLite fixture `test/fixtures/sqlite-schema.sql`, which must be kept in sync with the schema by hand), auth controller, reviews, document evidence, and app controller. The e2e test is not hermetic. Not covered: payments, inspections, payouts, KYC sync, media.

## 4. Web portal (apps/web)
- **Architecture:** one big SPA-ish script, `portal.js` (~2,700 lines, 159 KB), plus `portal.css` (72 KB).
  - Nine HTML pages are identical shells: admin, agreement, auth, dashboard, host-onboarding, invoice, kyc, payment, tracking. `main()` routes by `location.pathname`.
  - `index.html` and `cars.html` are also identical.
  - about, services, contact and calculator are standalone marketing pages with `luxury-theme.css` and a stub `safar-auth.js`. They are not linked from the portal.
- **API access:** `fetch('/api'+path)`, same origin, cookie auth. There is no configurable API base URL.
- **Helpers in portal.js:** `esc()` for HTML escaping, `api`/`post`, `shell()` (header and nav), `requireUser(roles)` as the client-side gate, `showDialog`, `badge`.
- **Admin page:**
  - Metric cards; tabs for vehicles, documents, bookings, users, payouts and audit; CSV export.
  - Vehicle tile grid, the "Add New Car" dialog (`POST /admin/vehicles`), and the car-folder dialog `openCarFolder` with Overview, Rate, Photos, Compliance and Schedule tabs.
- **Deploy:** Cloudflare (`npx wrangler deploy` at the repo root) publishes static files only. Production needs `/api/*` proxied to a separately hosted NestJS service (e.g. AWS), which doesn't exist yet. See `CLOUDFLARE-DEPLOYMENT.md`.

## 5. Mobile app (apps/mobile)
- **Stack:** Expo ~56, expo-router (typed routes, React Compiler), RN 0.85, React 19, TypeScript 6. Bundle id `in.safar.selfdrive`, scheme `safar`.
- **Navigation:** five native tabs: index (search), trips, verification (KYC), host, wallet. Other routes (auth/login, auth/register, details/[id], booking/confirm, booking/agreement) have **no Stack `_layout`**, which is a structural problem.
- **Auth and API:** JWT stored in **AsyncStorage** (not SecureStore). There is no 401 handling. API base URL comes from `EXPO_PUBLIC_API_URL`, then the Metro host on :3000, then `localhost:3000` (`src/services/api.ts`).
- **What works:** search, vehicle details, KYC through DigiLocker with a manual "Sync", agreement view and acknowledge, trips with cancel and ratings, and the host Start Trip / End Trip camera inspections.
- **Broken or stub:**
  - Booking: never sends `requestKey`, so it always gets a 400. Fees are hardcoded on the client and don't use `/quote`. The UI says "Paid" while the booking is actually PENDING.
  - Host "list a car" is an alert stub.
  - Wallet top-up is disabled.
  - A fake "Driving License Verified" badge always shows.
  - Expo template junk is still present.

## 6. Done vs. not done (against the requirements doc)
- **Done:**
  - Roles
  - Date-aware availability with holds and blocks
  - Server-side quotes with deposit and km allowance
  - DigiLocker KYC with encrypted archive and admin review
  - Vehicle listing and admin approval
  - Booking agreement snapshot, PDF and acknowledgement audit
  - Host–Safar agreement per vehicle
  - Pickup and return inspections with required evidence
  - Settlement preview
  - Manual payment, refund and payout ledger
  - Encrypted bank details
  - Vehicle and party ratings
  - Admin console with CSV MIS
  - Basic notifications
- **Not done (launch blockers):**
  - Payment gateway (Razorpay or similar) with deposits, refunds and webhooks
  - Applying the cancellation policy
  - Automatic sweep of expired holds
  - Extensions
  - Damage dispute workflow
  - Email/phone OTP verification, password reset, Google sign-in, admin MFA
  - Private cloud object storage (S3) with signed URLs
  - Hosted PostgreSQL plus data migration
  - Backend hosting and the `/api` proxy, HTTPS domain
  - Queue-based notifications (email/SMS/WhatsApp/push); only `BOOKING_CREATED` exists
  - Support tickets
  - Granular RBAC and audit of payouts
  - Booking IDs in the format `SAF-YYYYMMDD-NNNNNN`
  - Vehicle state machine (Draft → Submitted → …)
  - Real mobile host onboarding and payment

## 7. Known bugs (fix list)

**Backend**
1. `bookings.service.ts` `inspect()` builds its result but never returns it, so the endpoint always gives an empty response body.
2. `Inspection @@unique([bookingId, stage])` makes a second DAMAGE report crash with Prisma P2002 (HTTP 500).
3. The "photo already used" check reads only `mediaId`, not the `mediaIds` JSON.
4. Cancellation ignores the refund percentage and marks the whole payment (deposit included) REFUND_PENDING.
5. Expired PENDING holds are never swept, which inflates counts and "upcoming" lists.
6. `POST /admin/vehicles` (admin.controller.ts ~90-173):
   - creates fake Media rows (files don't exist, so `/api/media/:id` returns 500);
   - auto-APPROVES RC, insurance and PUC with no evidence, bypassing compliance;
   - stores `AUTOMATIC`/`PETROL` in uppercase while hosts store `Automatic`/`Petrol`, so search filters miss one set;
   - stores `images` as a bare URL instead of a JSON array.
7. The CSV export doesn't neutralise formula injection (`=`, `+`, `-`, `@`).
8. The rate limiter is in memory, has no `trust proxy`, and covers only auth, kyc and media POSTs.
9. Payout status can move backwards (e.g. PAID → PENDING) and payout changes aren't audit-logged.
10. Vehicle reviews are unique per vehicle, not per booking, and there's no DB constraint.
11. The agreement PDF temp directory leaks on errors and paths are resolved from `process.cwd()`.
12. Dead code:
    - `src/kyc/document-certificate.util.ts` generates fake government-looking certificates. Delete it.
    - `prisma/seed.ts` is stale.
    - `schema.previous.prisma`.
    - The "Hello World" AppController.
    - `convert_agreement_pdf.ps1`.

**Web (`portal.js`)**
1. Vehicle image format mismatch: `getVehicleCover` splits on commas, while `photoUrl` uses `JSON.parse`. Host vehicles store JSON and admin vehicles store a plain URL, so covers break.
2. XSS: unescaped image URLs in `src="${...}"`, in `getVehicleCover`/`photoUrl` usages (~lines 315, 946, 1442, 2116, 2542), and unescaped `data-kind="${doc.kind}"` (~1301).
3. The car-folder Compliance tab links `/api/media/${d.id}`; it should be `d.mediaId` (~2627).
4. "Image URL (optional)" is still required, because `inp()` always adds `required`.
5. Stray `</div>` in the vehicle tile markup (~2121-2138).
6. Undefined CSS vars: `--ink`, `--muted`, `--line`, `--color-surface`, `--color-border`.
7. `?service=` links from services.html are ignored.
8. Duplicated code: `openVehicleSchedule` vs `loadFolderSchedule`, and two separate pricing dialogs. The `.vehicle-review-action` handler is dead.
9. Placeholder contacts: `+919999999999`, and the hardcoded "Gujarat • 5 Hubs Live" badge.

**Mobile**
1. Booking is missing `requestKey` (`booking/confirm.tsx`), has hardcoded fees, and shows misleading "Paid" text.
2. No Stack layout for non-tab routes.
3. Search URL bug in `index.tsx`: when the city is "All" it builds `/vehicles&search=…`, and nothing is URL-encoded.
4. `useAuth` is loaded via `require()` in 7 screens, so everything is typed `any`. Use a normal import.
5. Missing null checks (`vehicle.host.firstName`, `review.author.firstName`, `user.firstName`, and others).
6. Hardcoded past fallback dates `2026-06-28`/`2026-06-29` in `details/[id].tsx`.
7. The trips tab is classified by `endDate`, not status.
8. Fake KYC badge and placeholder card number in `wallet.tsx`.
9. Errors only go to `console.error`.

## 8. SECURITY — urgent
- **Live Sandbox.co.in API key and secret are committed** in `scripts/test-fetch-files.js` and `scripts/test-sandbox-session.js`. They have been in git since the initial commit and pushed to GitHub. **Rotate the keys at Sandbox, delete the scripts, and purge them from history** (git filter-repo / BFG).
- **A JWT signing secret is hardcoded** in `scripts/test-approval.js` and `scripts/test-doc-evidence.js`, which use it to forge ADMIN tokens. Never reuse that secret anywhere.
- **Real developer email and user/document UUIDs are hardcoded** in `scripts/promote-admin.js`, `check-devendra-docs.js` and the `test-*.js` scripts.
- **Mobile JWT is in AsyncStorage.** Move it to `expo-secure-store`.

## 9. Cleanup candidates
- **Root scripts:** delete everything except `scripts/setup.js`. `test-registration-and-kyc.js` could become a real e2e test; `promote-admin.js` should become a generic CLI that takes the email as an argument.
- **Junk in `apps/web`:** `test.txt`, `gen.py`, `index_part1.txt`, `test_dark_preview.png`, unused `logo*.png` files, and 12 unused `cars/*.jpg`. Only `creta.jpg` is used by the web, but the seed reads `apps/web/cars`, so check that before deleting.
- **Other files:** `docs/original-web/`, the duplicate `start.bat` and `stop.bat`, `registration-preview.jpg`, and the boilerplate `apps/backend/README.md`.
- **Mobile template leftovers:**
  - Assets: react-logo, expo-badge, tutorial-web, the explore tab icons, and the expo.icon iOS icon.
  - Components: `hint-row`, `web-badge`, `ui/collapsible`, and the "Docs" link in the web tab bar.
  - Unused dependencies: `@expo/ui`, `expo-glass-effect`, `expo-device`.
- **`docker-compose.yml`:** either wire it up for Postgres dev or delete it.
- **Branding:** decide between Safar, Safarcars and ZipTrip and unify. Brand colour is `#3B1259` (an older script used `#6B2D8B`).

## 10. Conventions to keep
- Backend code style: compact one-line guards; validation helpers in `src/common/validation.ts` (`text`, `number`, …); throw Nest HTTP exceptions; use Prisma `$transaction` for booking writes.
- Commits use conventional prefixes (`feat(admin):`, `fix(portal):`, `style(admin):`).
- Never invent charges: settlement deductions (damage, fuel, tolls, fines) are manual until reviewed. Don't display claims, ratings or deposits that the data doesn't support.
- Aadhaar eKYC returns signed XML. Preserve the original and never present a generated summary as the government document.
- Booking pricing and agreement terms are snapshotted at creation. Never change historical bookings.

## 11. Suggested next-work order
1. Rotate the leaked keys and scrub the secrets and test scripts from history.
2. Fix the mobile booking (`requestKey` + `/quote`), add the mobile Stack layout, and move the token to SecureStore.
3. Fix `POST /admin/vehicles` (no fake media or auto-approved docs; consistent enums and image format) and unify image parsing in `portal.js`. Escape image URLs.
4. Fix the `inspect()` return, DAMAGE uniqueness, the hold-expiry sweep (cron) and cancellation refund %.
5. Payment gateway integration (Razorpay): deposit hold or refund, webhooks, reconciliation.
6. Deploy: hosted Postgres plus migration, NestJS on AWS or similar, Cloudflare `/api` proxy, S3 private storage with signed URLs.
7. Auth hardening: email/OTP verification, password reset, admin MFA, token revocation, and a proper rate limiter.
8. Split `portal.js` into per-page modules, add tests for payments, inspections and payouts, and add CI.
