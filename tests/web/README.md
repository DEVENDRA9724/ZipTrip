# Web panel browser tests (Playwright)

Browser tests for the **Customer**, **Vehicle Owner** (HOST and DEALER) and **Admin** web panels.

## Isolation

Each run starts the compiled backend on its own port (default `3100`) with a fresh SQLite database seeded with synthetic data:

- The data is written by `support/server.js`.
- The users are `*@playwright.invalid` accounts with a test-only password.
- Everything goes in a new folder under the OS temp directory: the database, generated JWT and encryption keys, saved sessions, and traces or screenshots from failures. Uploaded files are kept in an in-memory object store (`MEDIA_STORAGE=memory`), never on disk or in S3.

The runs never touch `apps/backend/portal.db`, `apps/backend/.env`, real Sandbox/DigiLocker credentials, or any shared environment:

- The server process runs from the temp folder, so the developer `.env` is never loaded.
- Sandbox keys are blank.
- `BUSINESS_*` contact details are blank.
- Agreement PDF conversion is pointed at a non-existent executable.
- External image hosts are intercepted with `page.route` in the tests.

## One-time setup

### Windows (PowerShell or Git Bash)
```powershell
npm install                     # repo root: installs @playwright/test (pinned 1.63.0)
npm --prefix apps/backend ci    # backend dependencies, if not installed yet
npm run test:web:install        # downloads Chromium to %LOCALAPPDATA%\ms-playwright
```
- **Jest 30 native resolver:** needs the Microsoft Visual C++ 2015–2022 x64 runtime. Install it with `winget install Microsoft.VCRedist.2015+.x64` if Jest reports that `ts-jest` cannot be found.

### Ubuntu (22.04 / 24.04, including AWS EC2)
```bash
npm install
npm --prefix apps/backend ci
npm run test:web:install-deps   # Chromium plus the required system libraries (uses sudo apt-get)
```

## Running

```bash
npm run test:web                 # compiles apps/backend, then runs all browser tests headless
npx playwright test admin.spec   # a single file (the backend must already be compiled)
npx playwright test --headed     # watch the browser
SAFAR_PW_PORT=3200 npm run test:web   # use another port if 3100 is busy
```

- **Backend build:** `npm run test:web` compiles the backend with `tests/web/support/build-backend.js`. It writes the build cache to the OS temp folder, so the tracked `apps/backend/tsconfig.build.tsbuildinfo` is not modified.
- **Failure artifacts:** traces and screenshots are kept only for failed tests, inside the run's temp folder; the path is printed in the output. They contain only synthetic data. Open one with `npx playwright show-trace <path>/trace.zip`.

## Layout

| File | Covers |
|---|---|
| `auth.setup.ts` | Signs each synthetic role in once through `/api/auth/login` and saves its session. This keeps the suite inside the API's login rate limit. |
| `auth.spec.ts` | Valid and invalid login, protected-page redirects, logout invalidating the session cookie, and role restrictions (UI and API). |
| `customer.spec.ts` | Browsing approved listings, the detail page, booking validation, booking with request-key idempotency, and a conflict response without a false success message. |
| `owner.spec.ts` | Fleet scoping, RC/Insurance/PUC upload with the vehicle selector, a missing vehicle, cross-owner attempts, invalid and oversized files, no self-approval, calendar ownership, booking visibility, the DEALER role, and anonymous uploads. |
| `admin.spec.ts` | Admin sections, document review gating, image-URL rejection, public image and markup injection (stored hostile data), the URL allow-list, and placeholder removal (home, tracking, contact, calculator). |
| `fleet-payouts.spec.ts` | Admin fleet entry: a pending listing, only real photos, adding missing angles, no self-approval, and the honest "No evidence file" state. Payout bank verification: second approver bound to the reviewed version, stale-version refusal, payouts on hold after a change, and admins unable to review their own account. |
| `security.spec.ts` | CSP: a strict `script-src 'self'`, no violations on public, customer, owner and admin pages, and delegated handlers still working. Media authorization: public versus pending-car photos, private documents, a blocked account. Safe error bodies, and the missing-photo fallback. |

## Notes

- **Synthetic accounts:** `admin`, `admin2` (the second approver), `customer`, `customer2`, `hostA`, `hostB`, `dealer`, and `blockme` (blocked during the security spec).
- **Rate-limit budget:** a full run uses about 14 `POST /api/media` requests against the per-IP limit of 15 per minute. Spread new upload-heavy tests across files, or check the budget before adding more.

- **Workers:** tests run with **one worker** because they share one seeded database and the per-IP rate limits (15 POSTs per minute per path on auth, KYC and media). Each run starts from a fresh database, so runs are repeatable.
- **Prerequisite:** the suite needs Node.js 22 LTS. Install Chromium with `npm run test:web:install` (Windows) or `npm run test:web:install-deps` (Ubuntu) before the first run.
