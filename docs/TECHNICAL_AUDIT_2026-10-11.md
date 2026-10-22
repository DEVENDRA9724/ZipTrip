# Safar Self Drive — Technical Audit (verified baseline)

| | |
|---|---|
| Date | 2026-10-11 |
| Commit audited | `79a1280` (branch `new-change`, identical to `main` and `origin/main`) |
| Scope | `apps/backend`, `apps/web`, `apps/mobile`, root scripts, deployment and configuration files, documentation |
| Method | Read-only source review. Every finding below was checked against the current code; file:line references are relative to the app folder unless the full path is given. No application file, dependency, database or infrastructure was changed. |
| Execution | The original audit was static because Node was missing. **The Phase 0 executed baseline is recorded in §4.0.** |

`docs/PROJECT_AUDIT.md` (written earlier today) is mostly accurate, but it **missed several blocking defects**:
- The mobile app never calls the `/api` prefix.
- The mobile vehicle-details screen crashes.
- Mobile booking dates are rejected by the server.
- Web RC/insurance/PUC uploads always fail.
- Payouts are not audit-logged.

It also said mobile search and details "work"; they do not. Treat this document as the baseline from now on.

---

## 1. Architecture and verified functionality

### 1.1 Topology
```
Browser ──► NestJS (apps/backend, :3000)
              ├─ /api/*            REST API (global prefix 'api', main.ts:12)
              └─ /*                static apps/web via useStaticAssets (main.ts:41-46)
Expo app ──► same API via Bearer token (apps/mobile/src/services/api.ts)
Cloudflare  wrangler.toml publishes apps/web as static assets ONLY — there is no /api proxy and no backend host
```
- **Backend stack:** NestJS 11.1, Express 5, Prisma 7.8 with driver adapters (better-sqlite3 in development, pg when `DATABASE_URL` is `postgres://`). bcryptjs, sharp, multer. The agreement PDF is produced by Python subprocesses.
- **Database:** SQLite through `prisma db push` in development. PostgreSQL schema and 7 hand-written migrations exist but have never been deployed. Production startup refuses SQLite (`src/prisma/prisma.service.ts:10`).
- **Web:** vanilla JavaScript.
  - One `portal.js` file of about 2,700 lines and 159 KB, routed by filename (`portal.js:2478-2494`).
  - Nine byte-identical HTML shells.
  - Four legacy marketing pages that are not linked from the portal.
- **Mobile:** Expo SDK 56, expo-router, React Native 0.85, React 19, five NativeTabs.
- **Not present:** CI configuration, a backend Dockerfile, a staging environment, a job scheduler or queue. Redis is defined in `docker-compose.yml` but nothing uses it.

### 1.2 Verified implementation by area

| Area | Actual implementation (verified) | Status |
|---|---|---|
| **Roles** | There is a single `role` enum per user: CUSTOMER, HOST, DEALER, ADMIN. You pick CUSTOMER, HOST or DEALER yourself at registration (`auth.service.ts:20`); there is no approval step. ADMIN comes only from `scripts/create-admin.js` or the seed. No endpoint changes a role. Role checks are written inline in each handler using `admin()` and `fleetManager()` (`common/validation.ts:19-25`); there are no Nest guards for roles. The JWT guard reloads the role and the `isBlocked` flag from the database on every request (`auth/jwt-auth.guard.ts:20-24`). | Works. Coarse: no RBAC, no multi-role support. |
| **Vehicle listing** | Hosts and dealers call `POST /vehicles` (`vehicles.service.ts:119-148`). It requires 8 owned photos (one of each angle, distinct SHA-256) and a normalised registration number, and creates the car as `PENDING_APPROVAL`. `images` is stored as a JSON array. | Works, except that document upload on the web is broken (§5, W1). |
| **Vehicle approval** | `POST /admin/vehicles/:id/review` (`admin.controller.ts:175-192`). Admins cannot review their own car. Setting a car to ACTIVE requires the registration number, all 8 photos, and RC, insurance and PUC approved and not expired. | Works. |
| **Admin direct create** | `POST /admin/vehicles` (`admin.controller.ts:90-173`):<br>• creates the car as **ACTIVE** immediately;<br>• creates **8 Media rows whose files are never written** (`:131-143`);<br>• creates **RC, insurance and PUC documents already APPROVED, with no evidence and 3 years' validity** (`:148-160`);<br>• stores `images` as a raw string and uses uppercase enum values. | **Compliance bypass.** |
| **Booking states** | Enum PENDING→CONFIRMED→ACTIVE→COMPLETED, plus CANCELLED. Who moves a booking between states:<br>• PENDING: the customer creating it (`bookings.service.ts:56`).<br>• CONFIRMED: only an admin recording a manual payment (`admin.controller.ts:206`).<br>• ACTIVE / COMPLETED: pickup and return inspections (`bookings.service.ts:279`).<br>• CANCELLED: cancellation, or an admin releasing the hold.<br>There is no no-show state or automatic completion. A CONFIRMED booking whose period passes without pickup stays CONFIRMED forever. | Partial. |
| **30-min hold** | `expiresAt = min(now + 30 min, start)` (`:57`). An expired hold is ignored by the overlap check (`availability.ts:16`) and when an admin records payment. **Nothing ever moves expired holds out of PENDING.** | Partial. |
| **requestKey idempotency** | The key is `customerId + ':' + requestKey`, protected by a database unique constraint (`schema.prisma:119`). A replay inside the transaction returns the original booking if the vehicle and dates match, otherwise a 409 (`bookings.service.ts:20-25`). Defects:<br>• a replay sends `BOOKING_CREATED` notifications again (`:61`);<br>• a replay returns cancelled or expired bookings as if they were live;<br>• two concurrent requests with the same key produce a 409 instead of the original booking. | Works, with defects. |
| **Availability** | The overlap check covers CONFIRMED and ACTIVE bookings, PENDING holds that haven't expired, unreleased availability blocks, and RC, insurance and PUC being valid through the return date. Bookings for a vehicle are serialised by writing to the vehicle row inside the transaction (`:31,40`). There is no database exclusion constraint. | Correct on PostgreSQL (row lock under READ COMMITTED). SQLite serialises all writers. |
| **Pricing** | `pricing.ts` and `rental-policy.ts`:<br>• every started 24 hours is billed as one day;<br>• included kilometres = floor(days × 300);<br>• amounts are calculated in paise;<br>• total = rent + ₹2,000 deposit.<br>The values can be overridden by environment variables. The quote endpoint uses the same function. `expectedTotal` is optional on booking (`bookings.service.ts:46`). | Works. |
| **Trip start/end** | `inspect()` (`bookings.service.ts:246-286`):<br>• **Who:** PICKUP and RETURN by the host or an admin; DAMAGE also by the customer, during an ACTIVE trip.<br>• **Pickup timing:** only allowed between start and end.<br>• **Requires:** an odometer photo, a selfie and a condition photo, fuel %, and a condition note.<br>• **Response:** **the method never returns its result, so the response body is empty.** | Works, with defects. |
| **Settlement** | `GET /admin/bookings/:id/settlement` is a read-only calculation of excess kilometres and late-return charges. Nothing is saved, and there is no endpoint to release or deduct the deposit. | Preview only. |
| **Reviews** | A vehicle review needs a COMPLETED booking and the reviewer must be that booking's customer. Only one is allowed per author per vehicle, and this is enforced **in code only**. Party ratings go customer↔host, with a database unique constraint on (booking, author, target). **There is no moderation of any kind: no hide, report, edit, delete or response.** `GET /reviews/user/:id` is public. | Partial. |
| **Manual payments** | An admin calls `POST /admin/bookings/:id/payment`. The amount must exactly equal the server-side `totalAmount`; the reference becomes `transactionId` (unique); the payment, invoice and audit entry are created in one transaction. It is idempotent on (reference, amount). | Works. |
| **Refunds** | Customer or host cancellation sets the payment to `REFUND_PENDING` **for the full amount, ignoring the 100/50/0 % policy** (`bookings.service.ts:240`). The admin's `/refund` call sets it to `REFUNDED` but records no amount. | **Incorrect.** |
| **Payouts** | The bank account number is encrypted with AES-256-GCM and only the last four digits are shown. There is no decrypt path anywhere. Payouts are entered manually by an admin, are not linked to bookings or earnings, **can move to any status (including PAID→PENDING), and are not audit-logged** (`payouts.service.ts:66-84`). | Ledger only. |
| **Wallet** | Shows the balance only. `POST /wallet/deposit` always returns 403. Nothing ever credits or debits a wallet. | Stub. |
| **KYC** | DigiLocker through the Sandbox.co.in API: start a session, sync, archive the original encrypted. Manual DL upload is reviewed by an admin, who must have viewed the evidence within the last 15 minutes (`admin.controller.ts:75`). `isVerified` requires an approved, non-test DL **and** an approved, non-test AADHAAR. Because AADHAAR can only arrive through a live DigiLocker sync, **no user can become verified without live Sandbox credentials** (only seeded users can). `isVerified` is not re-checked when the DL expires. | Works in live mode only. |
| **Agreement PDF** | `spawn(python populate_agreement.py)` → `soffice` → ReportLab fallback (`bookings.service.ts:173-231`). Arguments are passed as an array, so there is no command injection. Problems:<br>• no timeout;<br>• the temporary folder (which contains PII) is deleted only when the run succeeds;<br>• error output (stderr) is sent back to the client.<br>The template prints "Verified: Yes" for every customer, uses the wrong km label and hardcoded refund tiers, and stamps "Accepted on" whether or not anyone accepted. | Works, with content defects. |
| **Notifications** | Only `BOOKING_CREATED` is ever created (`bookings.service.ts:61`). The message promises a "host confirmation" step that doesn't exist. List and mark-read endpoints exist; no web or mobile screen calls them. | Minimal. |
| **Uploads** | Multer accepts up to 8 MB. sharp checks the image and re-encodes it as JPEG. DL, RC, insurance and PUC files are encrypted. Storage keys are server-generated UUIDs, so there is no path traversal. **Inspection photos can only be read by the person who uploaded them**, so the other party to a trip cannot see the evidence (`media.service.ts:67-68`). Orphaned files are never cleaned up. | Works, with gaps. |
| **Audit logging** | About 20 actions are logged in `admin.controller.ts`, `bookings.service.ts`, `kyc.controller.ts` and `vehicles.service.ts`. **Not logged:**<br>• payouts;<br>• booking creation;<br>• host vehicle creation;<br>• DigiLocker sync;<br>• logins and registration;<br>• the bulk PII CSV export.<br>Audit rows carry no IP or device information and have no foreign keys. | Partial. |

---

## 2. Prisma models and relationships (`prisma/schema.prisma`)

**Enums**
- `Role`: CUSTOMER, HOST, DEALER, ADMIN
- `BookingStatus`: PENDING, CONFIRMED, ACTIVE, COMPLETED, CANCELLED
- `VehicleStatus`: PENDING_APPROVAL, ACTIVE, INACTIVE, MAINTENANCE

No relation declares `onDelete`, so required relations use Restrict and optional ones use SetNull.

| Model | Key fields | Relations / constraints |
|---|---|---|
| User | email @unique, phone? @unique, passwordHash, role, isVerified, isBlocked, dlValidUntil? | 1:N vehicles, bookings, reviews, documents, kycSessions, media, notifications, ratingsGiven / ratingsReceived; 1:1 wallet?, payoutAccount? |
| Vehicle | hostId, make, model, year, category, transmission, fuelType *(String; casing differs between host and admin)*, seats, pricePerDay Decimal, status, locationCity, lat?/lng?, `images` *(String: JSON array **or** plain URL)*, registrationNumber? @unique, odometer | host→User; @@index(locationCity, status) |
| AvailabilityBlock | vehicleId, startDate, endDate, reason, releasedAt? | →Vehicle; @@index(vehicleId, startDate, endDate) |
| Booking | bookingRef @unique, requestKey? @unique, customerId, vehicleId, start/end, totalAmount, dailyRate, rentalDays, includedKilometres?, securityDeposit, expiresAt?, agreementVersion, agreementSnapshot *(JSON)* | →User, →Vehicle; 1:1 payment?, invoice?; 1:N inspections, partyRatings; @@index(vehicleId, startDate, endDate, status) |
| Payment | bookingId @unique, transactionId @unique, amount, status *(String: SUCCESS / REFUND_PENDING / REFUNDED)* | →Booking |
| Invoice | number @unique, bookingId @unique, amount, status, snapshot *(JSON)* | →Booking |
| Inspection | bookingId, stage *(String)*, odometer, mediaId *(no FK)*, mediaIds *(JSON)*, fuelPercent?, damageNote? | →Booking; **@@unique(bookingId, stage)** |
| Media | ownerId, vehicleId?, kind, storageKey @unique, mimeType, size, sha256 | →User, →Vehicle?; @@index(ownerId, vehicleId) |
| Document | userId, vehicleId?, kind, mediaId? *(no FK)*, status, source, providerSessionId? *(no FK)*, validUntil? | →User, →Vehicle?; @@index(userId, kind, status) |
| KycSession | userId, providerId @unique, environment, status, consentAt, consentVersion, expiresAt | →User (no index on userId) |
| Review | authorId, vehicleId, rating, comment? | →User, →Vehicle; **no unique constraint, no bookingId, no index** |
| PartyRating | bookingId, authorId, targetId, targetRole, rating | →Booking, →User ×2; @@unique(bookingId, authorId, targetId) |
| Wallet | userId @unique, balance | →User |
| Notification | userId, type, title, message, bookingId? *(no FK)*, metadata? *(JSON)*, readAt? | →User; @@index(userId, readAt, createdAt) |
| PayoutAccount | userId @unique, holder, bank, last4, ifsc, encryptedAccountNumber, status | →User; 1:N payouts |
| Payout | accountId, amount, status, reference?, periodStart?/End?, note?, processedAt? | →PayoutAccount; @@index(accountId, status) |
| AuditLog | actorId, action, targetId, detail | **no relations, no indexes** |

**Schema files and migrations**
- `postgresql/schema.prisma` is identical to `schema.prisma` apart from the provider line; it is generated by `scripts/prepare-postgres.js`.
- `schema.previous.prisma` is the state after the initial migration and is stale.
- There are 7 PostgreSQL migrations: 0001 initial, 0002 rental operations, 0003 DEALER and isBlocked, 0004 agreement snapshot, 0005 inspections and payouts, 0006 party ratings, 0007 notifications. Numbers 3–7 are hand-written using `IF NOT EXISTS`.
- **Drift:** `Payout.amount` is created as `DECIMAL` with no precision, while Prisma expects `DECIMAL(65,30)`. Nothing else drifts.
- **Indexes PostgreSQL will lack:** foreign keys are not indexed automatically, and these have no index: `Vehicle.hostId`, `Booking.customerId`, `KycSession.userId`, `Review(authorId, vehicleId)`, `AuditLog(targetId / actorId)`.
- `test/fixtures/sqlite-schema.sql` matches the current schema, but nothing enforces that it stays in sync.

---

## 3. API endpoint inventory (62 routes, all prefixed `/api`)

Legend:
- **Pub**: no authentication.
- **JWT**: `JwtAuthGuard`.
- **Admin**: JWT plus the `admin()` check, which is present in every admin handler.

| Group | Routes |
|---|---|
| App | `GET /` Pub (Hello World) |
| Auth | `POST auth/register` Pub · `POST auth/login` Pub · `POST auth/logout` Pub · `GET auth/profile` JWT |
| Account | `GET account/dashboard` JWT (view depends on role) |
| Vehicles | `GET vehicles` Pub (**returns full rows, including hostId, registration number and reviewNote**) · `GET vehicles/:id` Pub (ACTIVE only; **no host fields**) · `GET vehicles/:id/quote` Pub · `GET vehicles/mine` JWT · `GET vehicles/:id/schedule` owner/admin · `GET vehicles/:id/host-agreement`, `POST …/acknowledge` owner/admin · `POST vehicles/:id/availability-blocks`, `POST …/:blockId/release` owner/admin · `POST vehicles` HOST/DEALER/ADMIN |
| Bookings | `POST bookings` JWT + KYC · `GET bookings/my-trips` · `GET bookings/host-bookings` · `GET bookings/:id/agreement`, `GET …/agreement/pdf`, `POST …/agreement/acknowledge` customer/host/admin · `POST bookings/:id/cancel` customer/host · `POST bookings/:id/inspection` per stage |
| Invoices | `GET invoices/:id` customer/host/admin |
| Media | `POST media?kind=` JWT · `GET media/:id` optional auth (inline; **does not check isBlocked**) |
| KYC | `GET kyc` · `POST kyc/documents` · `POST kyc/sessions` · `POST kyc/sessions/:id/sync` · `GET kyc/documents/:id/evidence` · `GET kyc/documents/:id/certificate` (all JWT, owner) |
| Admin | `GET admin` · `GET admin/documents/:id/evidence` · `GET admin/documents/:id/certificate` · `POST admin/documents/:id/review` · `POST admin/vehicles` · `POST admin/vehicles/:id/review` · `POST admin/vehicles/:id/pricing` · `POST admin/bookings/:id/payment` · `POST admin/bookings/:id/hold` · `POST admin/bookings/:id/refund` · `GET admin/bookings/:id/settlement` · `POST admin/users/:id/block` · `GET admin/export.csv` |
| Payouts | `GET`/`POST payouts/account` fleet roles · `GET payouts` · `GET payouts/accounts` admin · `POST payouts/admin/create` admin · `POST payouts/:id/status` admin · `POST payouts/accounts/:id/status` admin |
| Reviews | `GET reviews/vehicle/:vehicleId` Pub · `GET reviews/user/:userId` **Pub** · `POST reviews` JWT · `POST reviews/party` JWT |
| Notifications | `GET notifications` · `POST notifications/read-all` · `POST notifications/:id/read` (JWT, owner) |
| Wallet | `GET wallet` · `POST wallet/deposit` (always 403) |

**Positive findings**
- Every mutating route is authenticated.
- No mass assignment: fields are mapped explicitly.
- Prices and payment amounts are computed or checked on the server.
- No client-supplied role is trusted.

**Routes with no client caller**
- `/notifications*` and `/wallet*` (web).
- `GET reviews/*`.
- `POST payouts/admin/create`.
- Both `certificate` routes.

---

## 4. Automated test baseline

### 4.0 Executed baseline (Phase 0, 2026-10-11, before any change, commit `79a1280`)

**Toolchain installed for this run:**
- Node v22.23.3 / npm 10.9.9, as a portable zip in `%USERPROFILE%\tools`, SHA-256 verified and added to the user PATH.
- Microsoft VC++ 2015–2022 x64 runtime, installed through winget. Jest 30's native resolver (`unrs-resolver`) needed it.

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` (apps/backend) | 833 packages. `npm audit` reports 18 vulnerabilities (2 critical, 8 high, 8 moderate), **all in indirect dependencies apart from the `prisma` CLI**:<br>• critical: `handlebars`, and `proxy-addr` (IP spoofing; relevant once `trust proxy` is enabled);<br>• high: `@prisma/config`/`prisma` (major-version fix), `brace-expansion`, `browserslist`, `deepmerge-ts`, `fast-uri`, `js-yaml`, `mysql2`.<br>Not fixed: dependency changes are outside the approved scope. |
| Prisma | `prisma validate` (SQLite and PostgreSQL configs); `prisma generate` | Both valid; client generated |
| Build | `tsc -p tsconfig.build.json` | **Pass** |
| Typecheck incl. specs | `tsc --noEmit` | **Pass** |
| Lint | `eslint "{src,test}/**/*.ts"` (without `--fix`) | **Fails, and failed before any change.** 1,576 problems (1,478 errors, 98 warnings):<br>• 834 `prettier/prettier`, mostly CRLF line endings in the Windows checkout;<br>• about 640 `no-unsafe-*` (bodies typed `any`);<br>• 7 `no-unused-vars`, 5 `no-require-imports`, others. |
| Unit / integration | `jest --ci` | **7/7 suites, 53/53 tests pass** |
| e2e | `jest --config test/jest-e2e.json` (scratch SQLite DB) | **1/1 pass** |
| Web syntax | `node --check portal.js safar-auth.js` | Pass |
| Runtime smoke | Compiled app on :3917 against a scratch SQLite DB | Boots and maps **62 routes**. `/`, `/admin.html` and `/api` return 200; `/api/auth/profile`, `/api/admin` and `POST /api/bookings` return 401 without a token. **`/test.txt`, `/gen.py` and `/index_part1.txt` returned 200 (served publicly), confirming §5.3.** |

**New finding:** `apps/backend/scripts/seed.js:17` ignores `UPLOAD_DIR` and always writes to `apps/backend/uploads`.

### 4.0.1 After Phase 1

| Check | Result |
|---|---|
| Build, typecheck | Pass |
| Jest | **8/8 suites, 55/55 tests pass** (adds `src/common/repository-secrets.spec.ts`) |
| e2e | 1/1 pass |
| Lint | 1,573 problems, down from 1,576. The new spec is lint-clean. |

### 4.0.2 After Phase 2 (backend fixes and dependency assessment, 2026-10-11)

| Check | Result |
|---|---|
| Build, typecheck | Pass |
| Jest | **14 of 14 suites, 85 of 85 tests pass** (30 new tests in 7 new spec files) |
| e2e | 1/1 pass. The hold sweep is off when `NODE_ENV=test`, so e2e no longer touches the developer database. |
| Mutation check | Each new regression test was run against the original (`HEAD`) code and failed for its specific defect: 7/7 booking-operations, 5/5 payouts, 3/3 media. The fixed code was restored and verified afterwards. |
| Runtime smoke (compiled `dist/main.js`, scratch database, `TRUST_PROXY=loopback`) | • The startup sweep cancelled a seeded expired hold and wrote exactly one `HOLD_EXPIRED` audit row.<br>• 6 concurrent identical registrations returned 1×201 and 5×409, with no 500s.<br>• No errors in the server log. |
| Lint | 1,692 problems, up from 1,573 after Phase 1:<br>• new spec files: `no-unsafe-*` from `any`-typed mocks, following the existing spec pattern;<br>• short additions inside existing compact-style files.<br>New source files are Prettier-formatted. Lint was already failing at baseline. |

**Dependency assessment (`apps/backend`)**
- **Updated:** only the vulnerable indirect packages, within their parents' existing semver ranges, using `npm update <pkg>`.
  - `package.json` is unchanged.
  - The lockfile changes 18 package versions. The `libc` platform metadata that npm 10 would otherwise drop was restored.
  - `npm ci --dry-run` is consistent with `package.json`.
- **Fixed:**
  - `proxy-addr` 2.0.7→2.0.8 (**critical**, runtime/Express; relevant to the new `TRUST_PROXY`)
  - `qs` 6.15.2→6.16.0 (runtime/Express)
  - `handlebars` 4.7.9→4.7.10 (**critical**, development: ts-jest)
  - `fast-uri` 3.1.2→3.1.8
  - `js-yaml` 4.2.0→4.3.2
  - `brace-expansion` (all copies)
  - `browserslist` and its data packages
- **Not applied: a blanket `npm audit fix`.** It would also move the Prisma CLI and engines from 7.8 to 7.10 while `@prisma/client` stays at 7.8, and add about 99 unrelated packages (Prisma Studio UI dependencies).
- **Remaining:** 0 critical, 4 high, 24 moderate.
  - **High, all Prisma CLI tooling:** `mysql2`, `deepmerge-ts`, `@prisma/config`, `prisma` (plus moderate `hono`, `@hono/node-server`, `valibot` via `@prisma/dev`). These fix only through a Prisma major version change, which is **out of scope until a separate plan is approved**. The CLI runs for generate/migrate, not inside the API process.
  - **Moderate, development only:** one `sprintf-js` advisory with no patched version reachable through `argparse`→`js-yaml@3`, which npm reports once for every Jest package above it. npm's suggested "fixes" are downgrades (`jest@25`, `ts-jest@27`) and were not applied.

### 4.0.3 Phase 3: web panel fixes, security hardening and Playwright (2026-10-11)

| Area | Root cause | Fix | Verified by |
|---|---|---|---|
| **3A Vehicle document uploads** | The web upload form had no `vehicleId` field (`?vehicle=` was read but never used). The API correctly requires a vehicle for RC, INSURANCE and PUC, so every vehicle-document upload failed. | `portal.js`:<br>• `dashboard()` loads `/vehicles/mine` for fleet roles on the KYC tab.<br>• `renderKycTabHtml()` adds a **Vehicle** selector, filled with escaped text and preselected from `?vehicle=`. It is enabled and required only for RC, INSURANCE and PUC. Customers only see DL.<br>• Before uploading, the client checks the vehicle, the type (JPEG/PNG/WebP) and the size (≤8 MB), so a rejected submission leaves no orphaned upload.<br>• **No backend change was needed.** The API already enforces the document-type allow-list, media ownership and type match, vehicle ownership (`hostId`), sharp content validation, the 8 MB limit (multer 413), encryption, and `PENDING` status (never auto-approved). Admins follow the same ownership rule. | Jest `kyc/vehicle-documents.integration.spec.ts` (10).<br>Playwright `owner.spec.ts` (12, including UI uploads, missing vehicle, cross-owner, invalid/oversized/unauthenticated, DEALER). |
| **3B Vehicle image URLs** | `POST /admin/vehicles` stored any admin text in `Vehicle.images`. `photoUrl()` and `getVehicleCover()` inserted it unescaped into `src="…"` in five templates: the public card and detail page, the host fleet list, the admin tile and the car folder. | **Server** (`common/image-url.ts`): admin URLs must be absolute `https:` (no credentials, no whitespace, quotes, `<>`, backtick, backslash or control characters; at most 2048 characters). They are stored as a JSON list like host listings. Leaving the field blank stores `[]` instead of the former Unsplash stock photo.<br>**Client** (`portal.js`): one `vehicleCoverUrl()`/`safeVehicleImageUrl()` allow-list (uploaded `/api/media/<id>`, bundled `cars/*.jpg`, or `https:`). **Image URLs are no longer placed in HTML strings:** templates emit a `data-img-slot` marker and the URL is assigned through `img.src` by a MutationObserver. Broken or rejected images fall back once to the logo. Existing hostile database rows render safely without any data cleanup. Admin photo links URL-encode media ids. | Jest `common/image-url.spec.ts` (19).<br>Playwright `admin.spec.ts` (6: stored `javascript:`, `data:`, attribute-breaking and markup payloads on the listing and detail pages, no script or dialog executed, https kept, http falls back, uploaded photos load, client allow-list cases). |
| **3C Placeholder UI** | The portal and legacy pages hard-coded:<br>• "Gujarat • 5 Hubs Live"<br>• `+91 99999 99999` and `wa.me/919999999999`<br>• "50+", "15+" and "250+" counts, "100% refundable deposit", "free doorstep delivery"<br>• a dead "Taxi with Driver" tab and dead service-switch and distance code<br>• a tracking "integration in progress" stub<br>• a fictitious headquarters and "24/7" helpline<br>• a taxi fare calculator with made-up rates | **`portal.js`:**<br>• header badge and phone removed<br>• hero figures come from the live `/vehicles` listing (cars listed, distinct cities) and are hidden if it is unavailable<br>• the city picker uses real listing cities<br>• Taxi tab and dead handlers removed<br>• tracking page states that live tracking is not available<br>• the booking panel's false "Free cancellation up to 6 hours" and "Doorstep Pickup" lines were replaced with neutral statements<br>**`about.html`, `services.html`, `contact.html`:**<br>• placeholders removed<br>• contact details now come from the new **`GET /api/contact`**: server `BUSINESS_PHONE`, `BUSINESS_EMAIL` and `BUSINESS_ADDRESS` only, validated, null when unset<br>• an honest "not published yet" state when nothing is configured<br>• taxi service block and calls to action removed<br>• false FAQ claims (zero-deposit scheme, 2-hour refunds, WhatsApp document upload) corrected to match the platform<br>**`calculator.html`** deleted; an archived copy remains in `docs/original-web`. | Playwright `admin.spec.ts` (4).<br>Jest `contact/contact.controller.spec.ts` (3). |
| **Payout UTR** | `PAID` could be recorded without a bank reference. | Moving a payout to `PAID` requires the UTR **in that request**. An earlier batch or failed-attempt reference is not accepted. The reference stays optional for other statuses, and a blank value never erases a stored one. Transition rules and audit logging are unchanged. The admin prompt says the UTR is required for PAID. | Jest `payouts.integration.spec.ts` (updated: 6 tests). |

**API changes:**
- **Added:** `GET /api/contact` (public, read-only).
- **Tightened:**
  - `POST /api/admin/vehicles` rejects non-https image URLs and stores `images` as JSON.
  - `POST /api/payouts/:id/status` requires `reference` when moving to `PAID`.

**Schema changes:** none.

**Mobile compatibility:**
- `parseImageList` already accepts JSON lists, so admin vehicles stored the new way still render.
- Mobile does not use `/contact` or payouts.

**New dependency:** `@playwright/test` 1.63.0 (root devDependency, exact pin, new root `package-lock.json`). Chromium is installed to `%LOCALAPPDATA%\ms-playwright`. `apps/backend` dependencies are unchanged in Phase 3.

**Results (actual):**

| Gate | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Backend build + typecheck | ✔ | – | – | – |
| Jest full suite | 117 (17 suites) | 0 | 0 | 0 |
| e2e | 1 | 0 | 0 | 0 |
| Playwright (3 consecutive runs, fresh DB each) | 36 | 0 | 0 | 0 |
| Secret scan (`repository-secrets.spec.ts`) | 5 | 0 | 0 | 0 |

**Regression checks against the original code:**
- **Web:** the Playwright suite was run against the original web files. **15 failed** (image security, placeholders, tracking/contact/calculator, detail wording, all 6 owner-selector tests). The 21 that passed cover authentication and server-side enforcement that already worked.
- **Backend:** the image-URL and UTR tests failed against code with those changes reverted. The fixed code was restored and re-verified.

**Lint (backend):** 1,710 problems, compared with 1,692 at the end of Phase 2.
- +22 in the two new spec files (`no-unsafe-*` from `any`-typed mocks and a `require` of better-sqlite3, the same pattern as the existing specs)
- +4 in `payouts.service.ts` and +1 in `app.module.ts` (long lines)
- −9 in `admin.controller.ts`
- The new source files `contact.controller.ts` and `image-url.ts` are clean.
- No rules were disabled.
- `apps/web` has no lint configuration; `node --check` passes on `portal.js` and `contact-info.js`.

**Remaining limitations:**
- Vehicle text fields (make, model, city) are still rendered through escaped template strings (`esc()`) rather than DOM APIs. Escaping is verified by the hostile-make test, but a full DOM-API rewrite of `portal.js` is out of scope.
- The production CSP still allows `'unsafe-inline'`, because of the existing inline handlers.
- `services.html` still shows a hard-coded self-drive price table, and `about.html` still has company-story copy. Both need content-owner review.
- Admin-created vehicles still get fake media rows and auto-approved documents (Phase 4). Their covers now fall back to the logo instead of showing a broken image.
- Logout clears the cookie but the JWT is not revoked server-side (existing design).

**Outstanding security risks:**
- The leaked Sandbox key and JWT secret are **not confirmed rotated**.
- Prisma CLI high advisories remain; see `docs/PRISMA_UPGRADE_PLAN.md`.
- The payout bank-change policy is undecided, and the current behaviour is riskier than the brief assumed; see `docs/PAYOUT_BANK_ACCOUNT_POLICY.md`.

**Confirmations:**
- `apps/mobile` is unmodified.
- Nothing has been staged, committed, pushed or deployed.
- The tracked `tsconfig.build.tsbuildinfo` is unchanged.
- The developer `portal.db` was not used by any test.

### 4.0.4 Phase 4: vehicle integrity, payout destination security and web hardening (2026-10-11)

**4A: admin-created vehicles.** Details: `docs/VEHICLE_COMPLIANCE_REMEDIATION.md`.
- **Root cause:** `POST /admin/vehicles` (`admin.controller.ts`) created the car `ACTIVE`, inserted 8 `Media` rows with no files, and inserted RC, Insurance and PUC documents already `APPROVED` (`ADMIN_FLEET_UPLOAD`, no evidence). It used its own looser validation, with uppercase enum values.
- **Fix:**
  - The endpoint now delegates to `VehiclesService.createByAdmin`, using the host-listing rules (`listingDetails`).
  - Cars start `PENDING_APPROVAL`, with no invented photos or documents.
  - Real photos are optional at creation, and missing angles can be added while pending (`POST /vehicles/:id/photos`; existing angles are never replaced).
  - Going live still requires review by a different administrator, with all 8 photos and evidence-approved RC, Insurance and PUC.
  - Administrators cannot review documents they submitted.
  - The admin UI was updated: honest dialog text, the same value lists as the host form, a missing-photo form, an "Upload RC/Insurance/PUC" link, and the compliance tab linking to `mediaId` evidence or "No evidence file".
- **Seeder:** `scripts/seed.js` labels its unverified approvals `DEMO_SEED` and refuses to run against production or PostgreSQL.
- **Existing data (dev `portal.db`, read-only):**
  - 0 admin-created cars, 0 fake media rows, 0 `ADMIN_FLEET_UPLOAD` documents.
  - **20** approved documents without evidence, all from the demo seeder. Reported only; nothing was rewritten.
- **Not done (needs a decision):** separate approval and availability states, and `DRAFT`/`REJECTED` (needs a migration plus product rules).

**4B: payout destination security.** Details: `docs/PAYOUT_BANK_ACCOUNT_POLICY.md`.
- **Account changes:** revisioned bank details, change detection by keyed HMAC fingerprint, and an unchanged resubmission keeps verification.
- **Second approver:** the reviewer must be an admin who is neither the owner nor the initiator, and approval is bound to the reviewed revision. Stale and concurrent approvals return 409, with exactly one audit row.
- **Snapshots and holds:** each payout keeps an immutable destination snapshot. `PROCESSING`/`PAID` is blocked while the destination is unverified, superseded or unknown, and each blocked attempt is audited.
- **Reconciliation:** explicit `CANCEL` or `REISSUE`. Snapshots are never edited.
- **Data exposure:** ciphertext and fingerprints are stripped from all responses.
- **Migration:** `202610110001_payout_destination_security` is additive. Legacy open payouts become `RECONCILIATION_REQUIRED` and final ones `LEGACY_UNVERIFIED`; legacy accounts need re-verification. No destination is guessed.

**4C: security hardening.**
- **CSP, now sent in every environment:**
  - `script-src 'self'`, `script-src-attr 'none'`, `object-src 'none'` and `connect-src 'self'`.
  - Google Fonts allowed explicitly (it was silently blocked in production before), and `blob:` images allowed for upload previews.
  - All inline `<script>` blocks and inline event handlers were removed. That covered 9 in `portal.js`, the 10 legacy-page `onclick`s, the legacy inline scripts (one of which wrote localStorage data into `innerHTML`), and the theme preload, which is now `theme-init.js` on all shells. Delegated listeners replace them.
  - **Remaining exposure:** `style-src 'unsafe-inline'` (inline style attributes are used throughout). That allows CSS injection only, not script execution.
- **DOM safety:**
  - The remaining bare `${…}` attribute interpolations (ids, kinds, amounts) are wrapped in `esc()`/`encodeURIComponent()`. These were all server-generated values; no exploitable path was found.
  - Query parameters were confirmed to be encoded before reaching API paths and never written raw into HTML.
  - `sectionHead`, `empty` and `showDialog` only receive constant text.
- **Media:**
  - Verified in the browser tests: pending-car photos are not public; private documents are restricted to their owner and admins; a blocked user loses access.
  - A missing media file now returns 404 "Image not found", where before the server returned a 500 and logged the upload path.
- **Logs and errors:**
  - The Sandbox client no longer logs full provider response bodies, which could contain identity data, and no longer returns provider or network error text to clients (`ProviderRequestError` keeps it for server-side classification).
  - Agreement converter logs keep only the last stderr line, with the work folder redacted.
  - Error bodies were checked for paths, SQL and stack traces.

**Results (actual):**

| Gate | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Backend build + typecheck | ✔ | – | – | – |
| Jest full suite | 127 (19 suites) | 0 | 0 | 0 |
| e2e | 1 | 0 | 0 | 0 |
| Migration verification (`npm run db:verify-migrations`: PGlite PostgreSQL and SQLite) | 10 | 0 | 0 | 0 |
| Playwright (2 consecutive runs) | 47 | 0 | 0 | 0 |
| Secret scan | 5 | 0 | 0 | 0 |

**Regression checks against earlier code:**

| Tests | Run against | Result |
|---|---|---|
| 4A (5 tests) | Phase 3 admin controller | 3 failed (the other 2 cover rules unchanged by the fix) |
| 4B (9 tests) | Phase 3 payouts service | 8 failed |
| CSP | Original inline `index.html` | `script-src-elem inline` violation |

**Lint (backend):** 1,822 problems, compared with 1,710 after Phase 3.
- **New problems:** mostly `no-unsafe-*` from `any`-typed test mocks in the new specs, plus +54 for new methods written in the existing compact style of `vehicles.service.ts`.
- **Reduced:** `admin.controller.ts` (−30) and `payouts.service.ts` (−44, reformatted).
- **Rules:** none disabled.

**Dependencies:** unchanged; see `docs/PRISMA_UPGRADE_PLAN.md` §2.1. The Prisma 8.0 release candidates are also inside the advisory ranges.

**Release blocker:** the leaked Sandbox key and JWT secret are still **not confirmed rotated**.

**Confirmations:**
- All Phase 4 work is local: nothing staged, committed, pushed or deployed.
- `apps/mobile` is unmodified.
- The dev `portal.db` was opened read-only and not migrated.

### 4.0.5 Phase 5: release readiness and data integrity (2026-10-11)

**Workstream 1: secrets.** See `docs/CREDENTIAL_ROTATION_CHECKLIST.md`.
- **Shared detectors:** the rules now live in `scripts/secret-detectors.cjs`, used by both the test and the new read-only history scan.
- **Bug fixed:** the fingerprint tokenizer kept `=` inside tokens, so a leaked value in a `.env` line (`KEY=value`) was never matched.
- **New fingerprints:** the leaked Sandbox key and secret were added, as SHA-256 only.
- **New test:** no `.env`, key or database file may be tracked.
- **`npm run secrets:scan-history`:** 402 file versions across 4 refs. It finds exactly the 4 known files in `0e6e599`, which is on `origin/main`.
- **Rotation: NOT confirmed** (release blocker).

**Workstream 2: local database.** See `docs/LOCAL_DATABASE_RECOVERY.md`.
- **Target confirmed:** `apps/backend/portal.db` is the only database file, used through `.env` (`file:./portal.db`); no PostgreSQL configuration exists.
- **Backup:** taken with the new `npm run db:backup` (integrity `ok`, row counts verified), and a restore was rehearsed in a temp copy.
- **Schema update:** `prisma db push` with an absolute path and no `--accept-data-loss`.
- **Verified after the update:**
  - integrity `ok`;
  - all row counts unchanged;
  - existing table data byte-for-byte identical;
  - payout columns and indexes match the fixture;
  - 0 payouts, so no destination was inferred.
- **Dev server:** restarted, and the payout endpoints return 200.

**Workstream 3: vehicle approval and availability.**
- **Plan only:** `docs/VEHICLE_APPROVAL_AVAILABILITY_PLAN.md` (model, transition table, conservative backfill, compatibility, tests). It awaits decisions D1–D4.
- **Characterisation tests:** today's guarantees are pinned by `src/vehicles/vehicle-eligibility.integration.spec.ts` (4 tests).

**Workstream 4: legacy documents.**
- The record-level report (redacted) and options A–E are in `docs/VEHICLE_COMPLIANCE_REMEDIATION.md` §6–7.
- **Findings:** 20 records, 0 audit rows each, backing all 6 listed demo cars and the demo customer's verification, with 0 bookings.
- **Unchanged:** no statuses were modified.

**Results (actual):**

| Gate | Passed | Failed | Skipped | Blocked |
|---|---|---|---|---|
| Backend build + typecheck | ✔ | – | – | – |
| Jest full suite | 133 (20 suites) | 0 | 0 | 0 |
| Targeted: payouts, vehicles, KYC, secrets | 65 | 0 | 0 | 0 |
| e2e | 1 | 0 | 0 | 0 |
| Migration verification | 10 | 0 | 0 | 0 |
| Playwright | 47 | 0 | 0 | 0 |
| History secret scan | 4 known findings (expected until history is rewritten) | – | – | – |

**Lint:** 1,841 problems, compared with 1,822 after Phase 4: +18 in the new eligibility spec (`any`-typed mocks) and +1 in the secrets spec (`require`). No rules disabled.

**Dependencies:** unchanged (0 critical, 4 high, 24 moderate, all in the Prisma CLI tool chain).

**Confirmations:**
- Local only: nothing staged, committed, pushed or deployed.
- `apps/mobile` is unmodified.

### 4.0.6 Phase 6: vehicle approval/availability split and compliance remediation (2026-10-11)

Decisions D1–D4 and remediation Option A were implemented locally; nothing was staged, committed, pushed or deployed. `apps/mobile` is untouched.

- **Model.** `Vehicle` gains `approvalStatus` (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED), `availability` (ACTIVE, INACTIVE), `availabilityReason`, `approvedById`, `approvedAt` and `rejectedReason`. The legacy `status` is kept and derived (`legacyVehicleStatus`) for existing readers. Rules live in `src/vehicles/vehicle-status.ts`.
- **Bookable** = APPROVED + ACTIVE + RC, Insurance and PUC that are approved, have an evidence file, come from a genuine source (not `DEMO_SEED` or `DIGILOCKER_TEST`) and are valid through the return date (today for undated listings). A missing expiry date never counts. This is enforced server-side in listing, detail, quote, booking creation and admin payment recording. Customers get safe messages; owners (`GET /vehicles/mine`) and admins (`GET /admin`) get reason codes.
- **D1.** Owners use `POST /vehicles/:id/availability` (pause or reactivate their own cars only) and `POST /vehicles/:id/submit`. Only administrators use `POST /admin/vehicles/:id/review` with `{decision: APPROVE|REJECT|REVOKE, note}`; self-review is refused. The old `{status}` body is still accepted and mapped as the plan describes.
- **D3.** Approval and reactivation re-check compliance. A rejected vehicle document revokes approval (audited) and flags upcoming bookings.
- **D4.** Pausing, suspension and revocation never cancel, refund or change bookings. Upcoming bookings (confirmed and not started, or live holds) get one `BOOKING_REVIEW_FLAGGED` audit row per booking and reason. Admins see them as `reviewFlags` and `metrics.bookingsNeedingReview` (with live non-compliance computed on each request).
- **Customer KYC.** Verification is recomputed only from genuine approved personal documents (`src/kyc/customer-verification.ts`). Admins cannot approve demo or test records.
- **Migration.** PostgreSQL: `prisma/postgresql/migrations/202610110002_vehicle_approval_availability` (additive, idempotent, one `VEHICLE_STATUS_BACKFILLED` audit row per car holding the previous status). SQLite: `prisma db push` + `npm run db:backfill-vehicles`. Both are verified on synthetic data by `npm run db:verify-migrations` (22 checks, including the relabel script against decoys).
- **Local data.** After a verified backup (`apps/backend/backups/portal-2026-10-11T11-47-30-644Z.db`), the 6 demo cars are PENDING_APPROVAL/INACTIVE (reason REVIEW_REQUIRED) and not bookable. The 20 legacy documents are relabelled DEMO_SEED (Option A, status kept, previous values audited), and the demo customer is no longer verified. The seeder now creates the same state.
- **Web.** The owner fleet shows approval and availability badges, the reasons a car is not bookable, pause and accept-bookings controls, and resubmission. The admin car folder has separate approval-decision and availability forms with reasons; bookings show review flags; KYC and document tables label demo and test records as unverified.
- **Open risk.** As the approved plan's transition table allows, an owner can reactivate a car an administrator suspended or put into maintenance, provided it is still approved and compliant. Restricting this needs a product decision.

### 4.0.7 Phase 7: hardening, lint remediation and dependency security (2026-10-11)

Local only; nothing staged, committed, pushed or deployed. `apps/mobile` is untouched.

- **Restriction policy, no schema change.** `availabilityReason` already separates owner-controlled states (`OWNER_PAUSED`, or no reason for a car never activated) from administrative restrictions (`ADMIN_SUSPENDED`, `MAINTENANCE`, `REVIEW_REQUIRED`; `ADMINISTRATIVE_RESTRICTIONS` in `vehicle-status.ts`).
  - Owners can pause and reactivate only cars they paused themselves. Lifting a restriction returns 403 with `reasons: ['RESTRICTED_<reason>']`.
  - An owner's pause never overwrites an administrative reason. This fixes a Phase 6 gap: an owner could previously turn a suspension into OWNER_PAUSED and then reactivate.
  - Administrators act with admin authority only on cars they do not own. On their own car they act as the owner, so another administrator must lift a restriction on it.
  - `REVIEW_REQUIRED` (the 6 backfilled demo cars) needs an administrator to activate, even after approval.
  - Every change is audited with `previousReason` and `capacity`. The owner UI shows the restriction instead of an "Accept bookings" button.
- **Lint.** 1,973 at the start of Phase 7, now 1,808 (Phase 5 baseline 1,841). No file and no rule is above its Phase 5 count. New Phase 6/7 files have 0 problems. In existing files only Phase 6/7 statements were reformatted; untouched code was left as it was. `test/types/better-sqlite3.d.ts` declares the two driver methods tests use, so no dependency was added.
- **Dependencies (backend audit 28 → 23; high 4 → 3, moderate 24 → 20).**
  - `hono` updated within its declared range to 4.13.13.
  - npm `overrides` (same major, Prisma dev tooling only): `@hono/node-server` 1.19.17, `valibot` 1.4.2 (the version Prisma's newer `@prisma/dev` ships), `mysql2` 3.24.5 (MySQL driver, unused here).
  - Prisma remains 7.8.0 (CLI and client).
  - **Not fixed:** `deepmerge-ts` <8 (high, pinned by `@prisma/config`, needs a major bump; Prisma 7.10 still pins 7.1.5) and `sprintf-js` (no patched release; reached via the jest/ts-jest coverage tooling).
- **Data checks.** All 14 integrity checks pass on the live DB, a restored backup and a fresh migration from the pre-migration backup. The restored backup is identical to the live DB, and re-running backfill and relabel changes nothing.
- **Results.** jest 21 suites / 145 tests, e2e 1/1, migrations 22/22, Playwright 50/50, repository-secrets 7/7, history scan: the 4 known findings.

### 4.0.8 Phase 8: security closure and release readiness (2026-10-12)

Local only; nothing staged, committed, pushed or deployed. `apps/mobile` is untouched. No credential was rotated, no Git history or ref was changed, and no database record was modified.

**Credentials (rotation OUTSTANDING).**
- All three exposed fingerprints (JWT signing secret, Sandbox live key, Sandbox live secret) match values in the historical files.
- The detectors flag each value in four `.env` and assignment forms, both as a local `.env` file and in code. A freshly generated secret is not flagged.
- `repository-secrets.spec.ts` passes 7/7, so no leaked value is configured on this machine.
- `docs/CREDENTIAL_ROTATION_CHECKLIST.md` gains a verification record (§6). Every provider-side step is outstanding.

**History cleanup (plan only).**
- The read-only scan still finds exactly the 4 known files from `0e6e599`.
- The remote has only `HEAD` and `refs/heads/main`: no tags and no `refs/pull/*`. Forks are unknown (`gh` is not installed).
- `scan-git-history.cjs` gained `--repo <path>`, so a rewritten mirror can be checked before publishing. It was verified on a disposable local mirror (same 4 findings) and on a clean repository (no findings, exit 0).
- `docs/GIT_HISTORY_CLEANUP_PLAN.md` was revised:
  - non-destructive preservation of local work (patch and tar, no stash);
  - bundle backup and restore commands, rehearsed on a scratch mirror;
  - publish with `--force-with-lease` on named refs instead of `--mirror`;
  - post-rewrite scanning, and handling of existing clones and forks.

**Dependencies (no change in Phase 8).** The backend audit has 23 findings (3 high, 20 moderate) from 2 root advisories. The production-only audit (`--omit=dev`) has 3 high, all `deepmerge-ts`. The root audit has 0.
- **`deepmerge-ts` 7.1.5** (high, GHSA-ggr8-5vv4-36mx).
  - **Vulnerable versions:** <8.0.0. 7.1.6 is also affected, and only 8.x is patched.
  - **Trigger:** stack exhaustion when two objects with cyclic self-references are merged.
  - **Path:** `@prisma/client` → `prisma` → `@prisma/config` (exact pin `7.1.5`; Prisma 7.10 pins the same). It is in the production tree.
  - **Prisma's use:** the merge function for loading `prisma.config.ts` through c12, with extends, rc files, `package.json` and remote configs disabled. Its only input is our own config file, and it never runs in the NestJS request path.
  - **8.0.2 probe:** identical output for Prisma-config-shaped inputs, and it handles the cyclic input that crashes 7.1.5. Its breaking changes affect `deepmergeInto` and type names, which Prisma does not use.
  - **Not applied:** forcing a new major version into the production tree, against Prisma's exact pin, needs a decision.
- **`sprintf-js` 1.0.3** (moderate, GHSA-hp3w-g68c-fv3c).
  - **No patched release exists.**
  - **Path:** `ts-jest` → `@jest/transform` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml@3` → `argparse@1`. Development only.
  - **Reachability:** `argparse` is loaded only by js-yaml's command-line binary, which nothing invokes.
  - It accounts for 20 of the moderate findings, all reported on the jest/ts-jest chain.

**Vehicle policy documentation.** `docs/VEHICLE_APPROVAL_AVAILABILITY_PLAN.md` §3 now describes the implemented transitions, including the Phase 7 restriction policy, the actual audit action names, admin-created drafts and automatic submission. The unimplemented `COMPLIANCE_EXPIRED` and forced deactivation were removed.
- **Open discrepancy (reported, behaviour unchanged; §9):** revocation keeps the car's availability. A revoked active car is `PENDING_APPROVAL` + `ACTIVE`: not bookable, but bookable again immediately on re-approval. The original design wording said availability is forced to `INACTIVE`. Choosing between keeping this and forcing `INACTIVE` + `REVIEW_REQUIRED` needs a decision.

**Data (read-only).**
- All 14 integrity checks pass on `portal.db`: 6 demo cars pending, inactive and review-held, none bookable (`GET /api/vehicles` returns `[]`); 20 `DEMO_SEED` documents with no evidence file; the demo customer unverified; audit rows exactly one per record.
- **Compared with the pre-migration backup:** every other table and column is identical. Only the intended fields changed, plus 27 audit rows.
- 0 documents have an evidence file, so nothing was fabricated.
- Databases, backups and `.env` are gitignored, and none is tracked.

**Results (all executed 2026-10-12):**
| Check | Result |
|---|---|
| Backend build and typecheck | pass |
| Jest | 21 suites / 145 tests passed |
| E2E | 1/1 |
| `db:verify-migrations` | 22/22 |
| Playwright | 50/50 |
| `repository-secrets` | 7/7 |
| History scan | 4 known findings, no new ones |
| Lint | 1,808 (Phase 5 baseline 1,841; no file or rule above baseline; 0 new) |
| npm audit | as above |

**Release blockers:**
1. Credential rotation and revocation (Sandbox key and secret, JWT secret), still to be verified by the account owner.
2. A decision on, and approval of, the Git history rewrite.
3. A decision on `deepmerge-ts`: accept the risk until Prisma updates, or approve an override.
4. A decision on revocation and availability (plan §9).
5. Uncommitted Phase 0–8 work: committing and pushing it needs authorization.
6. Real RC, Insurance and PUC evidence for any car before it can be listed.

### 4.0.9 Phase 9: decisions D1–D3 (2026-10-12)

Local only; nothing staged, committed, pushed or deployed. `apps/mobile` is untouched. No credential was rotated, and no history rewrite, ref change, database write or Prisma upgrade took place.

**D1. Revocation forces a review hold.**
- Admin `REVOKE` and a rejected vehicle document now write `REVOCATION_HOLD` (`src/vehicles/vehicle-status.ts`): `PENDING_APPROVAL`, `INACTIVE`, `REVIEW_REQUIRED`. The audit row records the previous availability and reason.
- Re-approval leaves the hold. An administrator who does not own the car must explicitly reactivate it, which re-checks approval and compliance. Owners cannot lift it (403).
- The legacy `{status:'ACTIVE'}` admin body remains an explicit approve-then-activate request through the same checks.
- Bookings and payments are unchanged; flags stay idempotent.
- Tests: 2 new and 1 updated in `vehicle-approval.integration.spec.ts`. The admin UI text explains the hold. No local car was ever approved, so no data changed.

**D2. `deepmerge-ts` override 8.0.2: kept.**
- `overrides["deepmerge-ts"] = "8.0.2"`. The lockfile changed only `deepmerge-ts` 7.1.5 → 8.0.2. Prisma is still 7.8.0 (CLI and client).
- **Compatibility shown:**
  - `@prisma/config` resolves 8.0.2 through its own ESM `import()`, and it handles the advisory's cyclic input.
  - `loadConfigFromFile` loads both `prisma.config.ts` and `prisma.postgres.config.ts` with no error and the expected schema, migrations path and provider.
  - `prisma validate` passes with both configs, and `prisma generate` works.
  - `db push` on a scratch copy reports "already in sync", and the read-only `migrate diff` against the live DB finds no difference.
  - The full regression below passes.
- **Audit:** backend 23 → 20 (high 3 → 0); production-only 3 → 0. The remaining finding is `sprintf-js` (20 moderate, development only, no patched release).

**D3. History cleanup prepared, not executed.**
- `docs/history-cleanup/` holds `paths-to-remove.txt`, the read-only gate script `verify-rewrite.cjs` and `EXECUTION_CHECKLIST.md` (go/no-go gates A1–A8, backup, rewrite, verify, publish, aftermath, rollback).
- **The Git backup bundle was deliberately not created:** it would contain the leaked credentials. The owner creates it at execution time, encrypted and offline (checklist B2).
- **Verifier tests:**
  - On an unmodified mirror of this repository it fails as expected (removed paths present, scanner findings).
  - On synthetic repositories: a cleaned history passes 6/6 and an uncleaned one fails.
  - No rewrite tool was run, not even on scratch copies, and project refs are unchanged.

**Results (executed 2026-10-12, after all changes):**
| Check | Result |
|---|---|
| Backend build and typecheck | pass |
| Jest | 21 suites / 147 tests |
| E2E | 1/1 |
| `db:verify-migrations` | 22/22 |
| Playwright | 50/50 |
| `repository-secrets` | 7/7 |
| History scan | 4 known findings |
| Lint | 1,808 (0 new; no file or rule above the Phase 5 baseline of 1,841) |
| npm audit | backend 20 moderate / 0 high; production 0; root 0 |
| Live DB integrity | 14/14 checks |

**Remaining release blockers:**
1. Credential rotation and revocation, to be verified by the account owner.
2. Approval and execution of the history cleanup checklist (after 1).
3. Authorization to commit and push the Phase 0–9 work.
4. Real RC, Insurance and PUC evidence before any car is listed.

### 4.1 Static inventory (pre-execution estimate, retained for reference)

The table below was written before Node was available. Its "Expected" column was a code-trace estimate, and the executed run in 4.0 confirmed every suite passes.

| Spec | Cases | Expected |
|---|---|---|
| `src/app.controller.spec.ts` | Hello World | pass |
| `src/auth/auth.controller.spec.ts` | returns JWT and sets cookie | pass |
| `src/bookings/pricing.spec.ts` | 6 / 12 / 24 / 36 / 48 h table; paise precision | pass, unless `DEFAULT_SECURITY_DEPOSIT` is set in the shell |
| `src/bookings/availability.spec.ts` | timezone parsing; 8 invalid periods; overlap predicate; search filtering | pass |
| `src/reviews/reviews.service.spec.ts` | 5 cases on review and party-rating eligibility | pass |
| `src/kyc/document-evidence.service.spec.ts` | about 20 cases on evidence, fallbacks and the approval gate | pass |
| `src/vehicles/availability.integration.spec.ts` | 4 scenario tests on a temporary SQLite database built from the fixture SQL | pass (hermetic) |
| `test/app.e2e-spec.ts` | `GET /` | **Not hermetic.** It uses the developer `DATABASE_URL` and has no JWT secret. |

**Not covered by any test:**
- `inspect()` (which is how the missing return went unnoticed)
- cancel, admin payment, refund, settlement
- admin vehicle creation
- payouts, media, agreement PDF
- notifications, account dashboards
- KYC `archive()`

**Missing tooling:**
- The web and mobile apps have no tests.
- Mobile has no ESLint configuration, although a `lint` script exists.
- There is no CI.

`scripts/test-flow.js` is not a test: it writes directly to the development database and bypasses the business rules.

**Phase 0 must establish the real baseline:** install Node 22 LTS, then run `npm ci`, `build`, `lint`, `test` and `test:e2e`, and record the results.

---

## 5. Security vulnerabilities and production blockers

### 5.1 Critical
| ID | Finding | Evidence |
|---|---|---|
| S1 | **A live Sandbox.co.in API key and secret are committed and present on GitHub `origin/main` since the initial commit** (2026-10-03). | `scripts/test-fetch-files.js:1-2`, `scripts/test-sandbox-session.js:1-2` |
| S2 | **A hardcoded JWT signing secret is used to forge ADMIN tokens.** If it matches any deployed `JWT_SECRET`, anyone can become admin. | `scripts/test-approval.js:12`, `scripts/test-doc-evidence.js:12` |
| S3 | **Admin vehicle creation fabricates compliance:** it creates APPROVED RC, insurance and PUC records with no evidence, plus fake media rows. | `admin.controller.ts:131-160` |
| S4 | **Stored XSS:** the unvalidated `images` value from the admin form is placed unescaped into `src="…"` on the public car card and details page. The production CSP allows `'unsafe-inline'`, and there is no CSP in development. | `portal.js:315, 946` (also `1442, 2116, 2542`); `admin.controller.ts:104` |

### 5.2 High
| ID | Finding | Evidence |
|---|---|---|
| S5 | A personal email address and user and document UUIDs are committed in scripts, and one script promotes that email to ADMIN. | `scripts/promote-admin.js`, `check-devendra-docs.js`, `test-*.js` |
| S6 | The payout ledger has no audit trail and allows any status change. An admin can save, verify and pay their own account without a trace. | `payouts.service.ts:20-33, 66-87` |
| S7 | CSV export formula injection: values beginning with `= + - @` are not neutralised. The export of bulk PII is not logged. | `admin.controller.ts:233-247` |
| S8 | The rate limiter is in memory, keyed on `req.ip`, and `trust proxy` is not set. Behind Cloudflare or a load balancer, every user shares one bucket of 15 requests per minute. It covers only auth, KYC and media POSTs. | `main.ts:16, 31-38` |
| S9 | The mobile JWT is stored in plaintext AsyncStorage, although the backend comment claims a "secure token store". | `mobile/src/context/AuthContext.tsx:28,51,68,81` |
| S10 | The agreement PDF endpoint is a GET that spawns python and soffice with no timeout or concurrency limit (resource exhaustion). The temporary folder holding PII is kept when a run fails, and error output (stderr) is returned to the client. | `bookings.service.ts:198-231` |
| S11 | `archive()` fetches any https URL the provider returns, with no host allowlist, and buffers the whole body before checking its size. The full provider JSON is logged. | `kyc/document-evidence.service.ts:31-41`; `sandbox.service.ts:43` |

### 5.3 Medium / low
- **Login enumeration:** login reveals "blocked" before checking the password, and skips bcrypt for unknown emails (`auth.service.ts:75-78`). Registration returns 409, revealing an existing email or phone.
- **No token revocation:** logout only clears the cookie, and the token stays valid for 8 hours. The JWT is also returned in the response body to web clients.
- **CSRF:** the Origin check is skipped when the `Origin` header is missing (`main.ts:30`). SameSite=Lax limits the exposure.
- **Public profile data:** `GET reviews/user/:id` is public and exposes names, roles and comments. `GET vehicles` exposes hostId, registration number and reviewNote.
- **Blocked users and media:** media read skips the `isBlocked` check. Blocking a host leaves their cars bookable.
- **Inline XML:** provider XML is served inline from the API origin.
- **Dead code:** `src/kyc/document-certificate.util.ts` generates fake "Government of Gujarat" style certificates. It is never imported but is still compiled. Delete it.
- **Junk served publicly:** `apps/web/test.txt`, `gen.py`, `index_part1.txt` and `test_dark_preview.png` are served by Nest and Cloudflare (there is no `.assetsignore`).
- **docker-compose:** contains hardcoded `root/rootpassword` credentials.
- **Weak configuration:** no global ValidationPipe, helmet or throttler. `tsconfig` is non-strict and request bodies are typed `any`.

### 5.4 Production blockers (functional)

| ID | Blocker | Evidence |
|---|---|---|
| B1 | **The mobile app cannot reach the API.** It never adds the `/api` prefix, so every call returns 404. If the prefix is added to the base URL instead, image URLs become `/api/api/media`, so no single configuration works. | `mobile/src/services/api.ts:4-27, 53`; `backend/src/main.ts:12` |
| B2 | **Mobile booking always fails.** It sends no `requestKey`, and it sends `YYYY-MM-DD` dates where `rentalPeriod` requires an ISO timestamp with a timezone. It also shows "Booking Confirmed / Paid" for what is actually an unpaid PENDING hold. | `booking/confirm.tsx:55-62, 93-108`; `availability.ts:6-8` |
| B3 | **The mobile vehicle-details screen crashes.** `findOne` doesn't include `host`, so `vehicle.host.firstName` is undefined. | `details/[id].tsx:106`; `vehicles.service.ts:27` |
| B4 | **Web RC, insurance and PUC uploads always fail.** The form has no `vehicleId` field (`?vehicle=` is read but never used), so host cars cannot get the documents they need to become ACTIVE through the UI. | `portal.js:1159, 1262-1272, 1346-1351`; `kyc.controller.ts:28-31` |
| B5 | **No customer can become verified without live DigiLocker.** AADHAAR is only created by a live sync. | `admin.controller.ts:71, 80-82`; `validation.ts` DOCUMENT_KINDS |
| B6 | **No payment gateway.** Every booking needs an admin to record a manual payment within 30 minutes. | `admin.controller.ts:193-218` |
| B7 | **No backend hosting, no `/api` proxy, no hosted PostgreSQL, no object storage, no CI.** | `CLOUDFLARE-DEPLOYMENT.md`, `wrangler.toml` |
| B8 | **The Prisma client is generated for one database provider at a time.** The default `db:generate` builds for SQLite; using that client with `PrismaPg` is expected to fail at runtime (not verified, because Node was unavailable). The scripts `create-admin.js`, `seed.js` and `test-flow.js` only work with SQLite. | `prisma.service.ts:11-13`; `package.json` scripts |
| B9 | **The cancellation refund policy is shown to customers but never applied.** Every cancellation queues a full refund including the deposit. A host can cancel a paid booking without any penalty. | `bookings.service.ts:232-244` |
| B10 | **Expired holds stay PENDING forever.** They inflate the dashboard's "upcoming" list and the admin counts. | `account.service.ts:23`; no scheduler anywhere |

### 5.5 Correctness defects (non-blocking)

**Backend**
- `inspect()` doesn't return its result (`bookings.service.ts:254-286`).
- A second DAMAGE report on the same booking causes a P2002 error and a 500 (`schema.prisma:202`).
- The check that stops a photo being reused only looks at `mediaId`, not `mediaIds` (`:271`).
- Acknowledgements are written against the current version constant but looked up by `booking.agreementVersion` (`:94` vs `:169`).
- Revenue, host "earnings" and `grossCollected` include deposits (`account.service.ts:56, 74-75`; mobile `host.tsx:156`).
- Values are stored inconsistently by different creators: `transmission` and `fuelType` casing differs (`vehicles.service.ts:136-138` vs `admin.controller.ts:99-100`), and so does the `images` format.
- Admin overview search is case-sensitive on PostgreSQL.
- Race conditions where a unique constraint is hit return 500 instead of 409: registration, admin vehicle create, party rating, payment reference.

**Web**
- `photoUrl` and `getVehicleCover` parse `images` in incompatible ways.
- The compliance link uses `d.id` where it should use `d.mediaId` (`portal.js:2620`).
- Malformed tile HTML with a stray `</div>` (`:2138`).
- `inp()` always adds `required`, so "optional" fields are mandatory (`:182`).
- The profile logout button has no handler (`:1658`).
- Undefined CSS variables.
- The EV category is filtered out on the cars page.
- The admin search and filter run client-side only.
- `crypto.randomUUID` fails over plain-HTTP LAN access.

**Mobile**
- No Stack layout for the non-tab routes.
- The search URL `/vehicles&…` is malformed.
- Dates are never sent to search.
- Hooks are loaded with `require()`.
- A blank fuel field always fails inspection, because it is sent as `undefined` (`host.tsx:123`).
- Fake "DL Verified" badge, fake card number, fake insurance claims.
- Offline startup logs the user out.
- Host listing is a stub.

---

## 6. Feature gaps against the role requirements

> **Decision needed:** the brief refers to "three-role requirements", but `Safar_Portal_Requirements.docx` §2 defines **four** roles (Administrator, Customer, Host/car owner, Dealer/franchise), and the code has four. This section assumes three workspaces: **Customer**, **Owner (HOST + DEALER, which share permissions in the code)** and **Admin**. Please confirm, or say whether DEALER needs its own business features (GST/PAN, branches, staff, commission).

| Requirement | Customer | Owner (Host / Dealer) | Admin |
|---|---|---|---|
| **Auth:** email verification, password reset, OTP, Google sign-in | ✗ none | ✗ | ✗ plus no MFA |
| **Account statuses** (invited / KYC pending / restricted / suspended / deleted) | only `isBlocked` | same | can block only |
| **KYC:** DigiLocker, DL upload fallback, expiry handling | ✓ live only; ✗ expiry is not re-evaluated | ✗ business KYC (PAN/GST), ✗ bank verification beyond manual status | ✓ review queue with a forced evidence view |
| **Vehicle onboarding:** resumable workflow, 8 states, about 20 photo angles, video | n/a | ✓ 8 photos, single submit; ✗ draft/resubmit; **✗ document upload broken (B4)**; ✗ mobile listing is a stub | ✓ approve / reject; ✗ suspend / archive states; ✗ compliance bypass (S3) |
| **Booking:** 10-state lifecycle, human-readable ID `SAF-YYYYMMDD-NNNNNN`, extensions | ✓ hold and booking on web; ✗ mobile broken; ✗ extensions | ✗ no confirmation step (by design?) | ✓ hold extend / release; ✗ cancel, extend, dispute |
| **Payment, deposit, refund** | ✗ no gateway | ✗ | manual only; ✗ refund amounts and partial refunds; ✗ deposit release / deduction |
| **Pickup / return / damage evidence** | ✓ damage report on web (only one per booking); ✗ customer pre-trip damage acknowledgement; ✗ cannot see host evidence | ✓ web and mobile (mobile fails when fuel is blank) | sees everything as admin; ✗ before/after comparison, ✗ damage review queue |
| **Settlement, invoices, statements** | ✓ receipt | ✗ settlement statement, ✗ commission | ✓ preview; ✗ persisted settlement, credit notes, GST fields |
| **Payouts** | n/a | ✓ bank account; ✗ earnings → payout link | ✓ manual ledger; ✗ audit, transition rules, no "create payout" UI |
| **Ratings / reviews** | ✓ vehicle and host ratings | ✓ rate customer; ✗ respond to reviews | **✗ moderation** (hide, report, appeal) |
| **Support / disputes** | ✗ | ✗ | ✗ |
| **Notifications** (email / SMS / WhatsApp / push, queue) | ✗ only one in-app event and no UI to read it | ✗ | ✗ |
| **Reports** | n/a | ✗ owner reports | ✓ booking MIS CSV; ✗ earnings, utilisation, KYC, damage reports |
| **Admin console:** RBAC editor, audit of old/new values, queues | n/a | n/a | ✗ RBAC; partial audit; tab-based console |

---

## 7. Migration and compatibility risks

**1. Moving from SQLite to PostgreSQL**
- The migrations reproduce the current schema except for the precision of `Payout.amount`.
- Generating the Prisma client for one provider breaks the other path (B8).
- `contains` searches become case-sensitive on PostgreSQL.
- Seed and admin scripts are SQLite-only.
- No data import has been rehearsed.
- **Rule:** every schema change from now on must update `schema.prisma`, add a new PostgreSQL migration, *and* update `test/fixtures/sqlite-schema.sql`.

**2. Hand-written migrations**
- Migrations 3–7 use `IF NOT EXISTS` and are not generated by `prisma migrate dev`.
- `prisma migrate diff` should be run against a scratch PostgreSQL database before adding any new migration.

**3. Inspection uniqueness change**
- Allowing several DAMAGE reports means replacing `@@unique(bookingId, stage)`.
- The rule must stay unique for PICKUP and RETURN (a partial unique index on PostgreSQL; SQLite needs a different approach).
- Existing rows are unaffected.

**4. Adding a unique constraint on Review (e.g. bookingId)**
- Existing duplicate rows must be found and resolved first.
- Rows have no `bookingId` to backfill from, so this needs a policy decision.

**5. Normalising historical vehicle data** (admin-created cars: uppercase enums, plain-string `images`, fake media, auto-approved documents)
- **This changes historical and compliance data. It needs your explicit approval.**
- It can be done non-destructively: map values when reading, or migrate with a backup.
- Removing the fake auto-approved documents would make those cars unbookable until real documents are uploaded.

**6. Mobile changes**
- Fixing the `/api` prefix and image URL handling changes how `EXPO_PUBLIC_API_URL` is used.
- Moving to SecureStore logs out every existing session once.
- Adding a Stack layout changes the navigation structure, so it needs testing on a device.

**7. Backend fixes that change behaviour clients may depend on**
- `inspect()` will start returning a body.
- Cancellation refund amounts will change.
- Adding the host to `GET vehicles/:id` exposes more data, so restrict it to first name.
- Trimming the public `GET vehicles` response could break the web, which reads `registrationNumber` on admin pages only. Verify that first.

**8. Secret rotation**
- Rotating the Sandbox key interrupts any in-flight DigiLocker sessions.
- Rewriting git history forces every clone, including the other contributor's, to re-clone.

**9. Agreement version**
- Fixing the acknowledgement-version mismatch must keep historical acknowledgements readable.

---

## 8. Phase-by-phase implementation plan

> **Scope update (2026-10-11): web panels only.**
>
> **In scope:**
> - the Admin, Vehicle Owner and Customer web panels;
> - the NestJS APIs those panels use;
> - Prisma models, migrations and PostgreSQL readiness;
> - preparing AWS Ubuntu hosting and an RDS PostgreSQL database.
>
> **Out of scope:** all `apps/mobile` work. Phase 6 below is deferred, and §5.4 B1–B3 are recorded but will not be fixed.
>
> **Rules that follow from this:**
> - Any shared backend change must state its mobile compatibility impact. The mobile app depends on: Bearer auth; the token returned in the login and register response body; the `GET /vehicles`, `GET /vehicles/:id`, `/bookings*`, `/kyc*`, `/media`, `/reviews*` and `/wallet` response shapes; and `requestKey` being required.
> - No placeholder data may be presented as real on the web. These items are added to Phase 5:
>   - hardcoded "Gujarat • 5 Hubs Live" and "50+ / 250+ Verified Cars" claims;
>   - placeholder phone number `+91 99999 99999`;
>   - fixed feature and policy claims on every car;
>   - the dead "Taxi with Driver" tab;
>   - the `tracking.html` stub;
>   - the unlinked legacy marketing pages.
> - Phase 8 targets **AWS Ubuntu (EC2) + RDS PostgreSQL**:
>   - Node 22 running under systemd or pm2;
>   - nginx serving `apps/web` and proxying `/api`, with TLS;
>   - RDS PostgreSQL with migrations applied through `db:pg:deploy`;
>   - S3 for private uploads;
>   - secrets kept outside the repository.

Each phase ends with:
- targeted and regression tests;
- a diff review;
- a report of files, migrations, API and UI changes, and test results.

Nothing is committed or pushed without authorisation.

### Phase 0: Toolchain and real baseline (prerequisite; no code changes)
- **You:** install Node 22 LTS. Optionally install Python 3 with `python-docx` and `reportlab` for agreement PDFs.
- **Me:**
  - In `apps/backend`: `npm ci`, `npm run build`, `npm run lint` (check only, without `--fix`), `npx jest`.
  - In `apps/mobile`: `npm ci`, `npx tsc --noEmit`.
  - Record the results.
  - Run `prisma validate` for both schemas.
  - Run `prisma migrate diff` against a scratch PostgreSQL database if Docker is available.
- **Exit criteria:** a recorded baseline of passes and failures that every later phase is compared against.

### Phase 1: Contain secrets and remove dead or unsafe code
- **Out-of-band, done by you:**
  - Rotate the Sandbox live key and secret.
  - Confirm no environment uses JWT secret `351c…`; rotate it if one does.
  - Decide whether to rewrite git history (BFG or `git filter-repo`) and force-push. This is destructive and needs your explicit authorisation.
- **Delete these root scripts:** `test-fetch-files.js`, `test-sandbox-session.js`, `test-approval.js`, `test-doc-evidence.js`, `test-direct-call.js`, `check-devendra-docs.js`, `promote-admin.js`, `patch-branding.js`, `patch-html.js`, `standardize-html.js`. Keep `setup.js`. `test-registration-and-kyc.js` is to be decided.
- **Delete** `apps/backend/src/kyc/document-certificate.util.ts` and remove the junk files from `apps/web`: `test.txt`, `gen.py`, `index_part1.txt`, `test_dark_preview.png`.
- **Tests:** build plus the full Jest suite must stay green. Add a check that no file in the repo matches `key_live_|secret_live_`.

### Phase 2: Backend correctness, no schema change
**Files:** `bookings.service.ts`, `account.service.ts`, `payouts.service.ts`, `admin.controller.ts`, `media.controller.ts`, `main.ts`, `common/validation.ts`

- **`inspect()`:** return its result.
- **Media reuse:** check `mediaIds` against all existing inspections.
- **Replays:** stop a replay re-sending `BOOKING_CREATED`.
- **Agreement acknowledgement:** use `booking.agreementVersion` when recording it.
- **Expired holds:** exclude them from the dashboards. Sweep them to a terminal state through a lazy update in a transaction, or a `setInterval` job. **Decision needed:** should they become CANCELLED, or should I add an EXPIRED status? Adding a status needs a migration and belongs in Phase 3.
- **Payouts:**
  - restrict which status transitions are allowed;
  - write an audit log entry for every account and payout action;
  - validate the payout period dates;
  - make payout creation idempotent.
- **CSV export:** neutralise formula injection and log the export.
- **Agreement PDF:** add try/finally cleanup, a timeout on the child process, and stop sending stderr to the client.
- **Media read:** check `isBlocked`.
- **Proxy:** set `trust proxy` through configuration (`TRUST_PROXY`).
- **Error handling:** map Prisma P2002 to 409 in the affected handlers.
- **Tests:** add specs for inspect, cancel, payouts, CSV escaping and the dashboard queries, extending `availability.integration.spec.ts`, which already provides a hermetic SQLite database.

### Phase 3: Schema hardening (migrations)
**Files:** `prisma/schema.prisma`, a new migration under `prisma/postgresql/migrations/2026101x_*`, `test/fixtures/sqlite-schema.sql`

- **Inspection uniqueness:** allow several DAMAGE reports while keeping PICKUP and RETURN unique.
- **Indexes:** add them on `Vehicle.hostId`, `Booking.customerId`, `KycSession.userId`, `Review(authorId, vehicleId)` and `AuditLog(targetId)`.
- **`Payout.amount`:** fix its precision.
- **Optional, and only with your approval:**
  - `Review.bookingId` with a unique constraint;
  - a booking-level unique key on `Payment.transactionId`;
  - an EXPIRED booking status.

### Phase 4: Vehicle compliance integrity (decisions required first)
**Files:** `admin.controller.ts:90-173`, `vehicles.service.ts`, `kyc.controller.ts`, `portal.js` (admin "Add New Car" and the car folder)

- **Admin creation:**
  - stop creating fake media and auto-approved documents;
  - reuse the `POST /vehicles` validation (uploads, enums, registration-number normalisation);
  - store `images` as a JSON array;
  - set status to PENDING_APPROVAL, or keep it ACTIVE only once real documents are approved.
- **Normalised reading:** parse `images` and the enum casing tolerantly when reading, so old rows keep working. Rewriting the data is a separate, approved step.
- **Decisions needed:**
  - Can an admin approve their own fleet cars (for example a two-admin rule, or a self-approval exception)?
  - What should happen to the existing admin-created cars?

### Phase 5: Web portal fixes
**File:** `apps/web/portal.js`, plus `portal.css` and the HTML shells

- **B4:** add a vehicle selector or hidden `vehicleId` field to the KYC upload form.
- **Images:** one `vehicleImages()` parser used by `photoUrl`, `getVehicleCover` and the fleet cover, with every URL passed through `esc()` and restricted to http(s) or same-origin. Add a server-side URL check in the admin create endpoint.
- **Small fixes:**
  - compliance link should use `mediaId`;
  - remove the stray `</div>` from the tile;
  - make `inp()` respect optional fields;
  - wire up the profile logout button;
  - define the missing CSS variables;
  - add the EV category;
  - send the admin search `q` and `status` to the server.
- **Tests:** web has no harness today. I propose adding a small Jest + jsdom test for the pure helpers (`esc`, the image parser), plus a written manual check list. **Decision needed:** whether to add a test dependency to `apps/web`.

### Phase 6: Mobile functional restoration — **DEFERRED (out of scope; web-only directive, 2026-10-11)**
**Files:** `apps/mobile/src/services/api.ts`, `src/app/_layout.tsx` (plus new Stack layouts), `booking/confirm.tsx`, `details/[id].tsx`, `index.tsx`, `host.tsx`, `wallet.tsx`, `trips.tsx`, `context/AuthContext.tsx`. Backend: `vehicles.service.ts` `findOne`.

- **API URL:** separate the API base URL (with `/api`) from the origin used for media.
- **Navigation:** add a Stack layout for the non-tab routes.
- **Booking:**
  - send `requestKey` and ISO timestamps with a timezone;
  - use `/quote` and `expectedTotal`;
  - show PENDING / "awaiting payment" truthfully;
  - remove the wallet gating.
- **Details screen:** add `host: { select: { firstName } }` to `findOne`, and add null guards.
- **Search:** fix the query builder and send the dates.
- **Inspection fuel:** require the fuel field in the UI, rather than relaxing the server.
- **Remove false claims:** the DL badge, card number, insurance claims and "Taxi" labels.
- **Auth:** use normal imports for `useAuth`, store the token in SecureStore (new dependency `expo-secure-store`), and add a 401 handler.
- **Tests:** `tsc --noEmit` plus unit tests for `api.ts` URL building. Navigation and booking need a manual check on a device.

### Phase 7: Financial policy (blocked on business decisions)
- Apply `cancellationRefundPercent` to the rent, separate from the deposit.
- Add recorded refund amounts and deposit release/deduction records.
- Decide the host-cancellation penalty.
- Exclude deposits from revenue and earnings figures.
- Link payouts to completed bookings net of commission.
- **Decisions needed:** the refund applies to rent only, or to rent plus deposit? Commission rate? Host cancellation policy? Who approves deductions?

### Phase 8: Production readiness
- **Database:** PostgreSQL client generation strategy (separate output paths, or a PostgreSQL-only build), make the scripts work with either adapter, and rehearse a data import.
- **Storage:** private S3-compatible storage with signed URLs, replacing local `UPLOAD_DIR`. *(Update 2026-10-20: done locally — uploads are S3-only, served through the API proxy instead of signed URLs so access checks stay server-side; see `docs/MEDIA_STORAGE.md`.)*
- **Hosting:** host the backend, add the Cloudflare `/api` proxy, add `.assetsignore`.
- **Hardening:**
  - a rate limiter backed by Redis or the platform;
  - helmet and a CSP without `'unsafe-inline'`, which requires moving the inline handlers out of `portal.js`;
  - a global exception filter.
- **CI:** GitHub Actions running build, lint, test and mobile `tsc` on pull requests.

### Phase 9: Feature gaps (from §6, each needing its own scope approval)
- Email verification and password reset, mobile OTP, admin MFA, token revocation.
- Payment gateway (Razorpay or similar) with webhooks.
- Review moderation.
- Notification service with real events and UI.
- Vehicle state machine with draft and resubmit.
- Human-readable booking IDs.
- Extensions, disputes and support cases.
- Owner and admin reports.
- Real mobile host onboarding.

---

## Recommended implementation order

| # | Phase | Why this order | Risk |
|---|---|---|---|
| 1 | **Phase 1 secret rotation (you, today)** | The live keys are public now, and rotating them is independent of the code. | None to the code |
| 2 | **Phase 0 toolchain and baseline** | No phase can be verified without it. | None |
| 3 | Phase 1 code cleanup | Small, deletion-only change; removes the S2 and S5 exposure from the working tree. | Low |
| 4 | Phase 2 backend correctness | High value, no schema change, testable with the existing hermetic harness. | Low–medium |
| 5 | Phase 5 web fixes (B4, S4 first) | Unblocks host compliance and closes the stored XSS. | Low |
| 6 | Phase 4 vehicle compliance | Needs your decisions; affects existing data. | Medium |
| 7 | Phase 3 schema hardening | The first migration; do it after the baseline and the Phase 2 tests exist. | Medium |
| 8 | ~~Phase 6 mobile restoration~~ | Deferred: web-only scope | — |
| 9 | Phase 7 financial policy | Blocked on business decisions. | High (money) |
| 10 | Phases 8–9 | Infrastructure and new features. | Varies |

## Decisions needed before proceeding

1. **Node.js:** please install Node 22 LTS (Phase 0). Should I also use Docker for a scratch PostgreSQL database to verify migrations?
2. **Secrets:** confirm you will rotate the Sandbox key. Do you authorise a git history rewrite and force-push (it affects the other contributor's clone)?
3. **Roles:** is the "three-role" model Customer / Owner (HOST + DEALER) / Admin, or does DEALER need separate features?
4. **Expired holds:** should they become CANCELLED, or a new EXPIRED status (needs a migration)?
5. **Admin-created vehicles:** remove the auto-approval going forward? What happens to existing admin-created cars and their fabricated documents and media?
6. **Web tests:** may I add a dev-only test dependency (Jest + jsdom) to `apps/web`?
7. **Refund policy:** confirm the rules (rent vs deposit, host cancellation) before Phase 7.
