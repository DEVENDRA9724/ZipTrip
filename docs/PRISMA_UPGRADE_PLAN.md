# Prisma Dependency Upgrade Plan

| | |
|---|---|
| Status | **Plan only. No Prisma version has been changed. The remaining advisories are NOT fixed.** |
| Prepared | 2026-10-11 (Phase 3) |
| Scope | `apps/backend` only (the mobile app does not use Prisma) |

## 1. Current state

| Package | Declared | Installed |
|---|---|---|
| `prisma` (CLI, devDependency) | `^7.8.0` | 7.8.0 |
| `@prisma/client` | `^7.8.0` | 7.8.0 |
| `@prisma/adapter-better-sqlite3` / `@prisma/adapter-pg` | `^7.8.0` | 7.8.x |
| Generator | `prisma-client-js` (classic client) | – |
| Datasources | SQLite (development, `db push`), PostgreSQL (target, 7 hand-written migrations) | – |

npm registry facts (checked 2026-10-11):

| Tag | Version | Notes |
|---|---|---|
| `prev` | **7.10.0** | Newest stable 7.x |
| `latest` | **8.0.0-rc.22** | Release candidate, not a stable release. Requires Node ≥ 22.18. |
| `next` | 8.0.0-rc.10 | |

## 2. Remaining advisories

All of these sit inside the **Prisma CLI tool chain**. None is loaded by the API process at runtime: the server imports `@prisma/client` and the driver adapters, not `prisma`.

| Advisory package | Severity | Pulled in by | Fixed in 7.10.0? | Exposure in this project |
|---|---|---|---|---|
| `mysql2` ≤ 3.23.0 | High | `prisma` → `mysql2@3.15.3` | **No** (7.10 still pins 3.15.3) | MySQL driver for the CLI's MySQL support. This project never uses MySQL, so the code path is not reached. |
| `deepmerge-ts` < 8.0.0 | High | `@prisma/config` → `deepmerge-ts@7.1.5` | **No** (7.10 still pins 7.1.5) | Merges trusted local config files (`prisma.config.ts`). It is not fed untrusted input. |
| `@prisma/config`, `prisma` | High | parent entries for the two above | No | – |
| `hono`, `@hono/node-server` | Moderate | `@prisma/dev` (local dev server) | **Yes** (`@prisma/dev@0.24.17` drops them) | Only used by `prisma dev`, which this project does not run. |
| `valibot` ≤ 1.4.1 | Moderate | `@prisma/dev` | **Yes** (1.4.2) | Same as above. |

npm's suggested remedy (`prisma@6.19.3`, a major **downgrade**) is rejected: it would undo the Prisma 7 driver-adapter architecture this code depends on.

### 2.1 Re-check during Phase 4 (2026-10-11)

`npm audit` in `apps/backend`: **0 critical, 4 high, 24 moderate**, unchanged from Phase 3. The root package (Playwright only) has 0. The registry still lists `latest` = 8.0.0-rc.22 and `prev` = 7.10.0.

**New information:** npm now reports the affected ranges as `prisma` 6.13.0-dev.1 – 8.1.0-dev.6 and `@prisma/config` 6.13.0-dev.1 – 8.1.0-dev.4. **The current Prisma 8.0 release candidates are therefore also affected.** Option B (wait for 8.0 GA) only helps if the GA release ships updated `mysql2` and `deepmerge-ts`; verify with `npm audit` before proposing it. npm's only listed "fix" is still a downgrade to `prisma@6.19.3`, which remains rejected. Nothing was upgraded in Phase 4.

## 3. Options

| Option | What it fixes | Risk | Recommendation |
|---|---|---|---|
| **A. Minor upgrade to 7.10.0** (CLI, client and both adapters together) | The 3 moderate advisories. **Not** the 2 high ones. | Low to medium: same major version, but a new engine build. Needs regenerated clients and a full regression run. | Do it as a separate approved change once Phase 3 is merged. |
| **B. Wait for Prisma 8.0 GA** | Possibly the high ones, if 8.0 drops or updates `mysql2` and `deepmerge-ts` (verify at release). | High: major version. Possible generator changes, `prisma.config.ts` and migration CLI changes, and a Node ≥ 22.18 requirement (the toolchain has 22.23, which is fine). | Re-assess when 8.0 is released. **Do not adopt a release candidate.** |
| **C. npm `overrides`** forcing `mysql2` ≥ 3.23.1 and `deepmerge-ts` ≥ 8 | Clears audit output | Medium to high: versions Prisma has not tested. `deepmerge-ts` 8 is a major change inside `@prisma/config`. | Not recommended unless a reachable exploit path is found. |
| **D. Accept and document** (the current state) | Nothing | Low exposure: CLI-only, trusted inputs, and the CLI should not run on production hosts except `migrate deploy`. | The interim position, recorded as an outstanding risk. |

Proposed sequence: **D now → A after approval → B at 8.0 GA (separate plan).**

## 4. Compatibility concerns to check before any upgrade

1. **Client and CLI lock-step.** `prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3` and `@prisma/adapter-pg` must be the same version. A blanket `npm audit fix` would have moved the CLI to 7.10 while leaving the client at 7.8; that was not applied.
2. **Dual-provider generation.** `prisma.service.ts` chooses SQLite or PostgreSQL at runtime, but the generated client is built for the provider in `schema.prisma` (SQLite). Confirm how the PostgreSQL deployment generates its client (`db:pg:generate`) and that both still work.
3. **Generator.** `prisma-client-js` is the classic generator. For 8.0, check whether it is still supported or whether the newer `prisma-client` generator (with an explicit output path) is required. Moving would change import paths across `src/`.
4. **`prisma.config.ts` / `prisma.postgres.config.ts`.** Check for config schema changes, especially `migrations.path`, `datasource.url` and `engine`.
5. **Migrations.** The 7 PostgreSQL migrations (3 to 7 hand-written with `IF NOT EXISTS`) must apply cleanly. `prisma migrate diff` must show no drift apart from the known `Payout.amount` `DECIMAL` precision issue. Do not edit applied migrations.
6. **Decimal and Date handling.** Money columns are `Decimal`. Check `Number(...)` conversions in pricing, payouts and CSV export still behave identically.
7. **Error codes.** `PrismaExceptionFilter` relies on `PrismaClientKnownRequestError` with code `P2002` for adapter unique violations. This was verified on 7.8 and must be re-verified.
8. **Native modules.** `better-sqlite3` and `sharp` are unaffected, but confirm `npm ci` on Windows (development) and Ubuntu (AWS target).

## 5. Required regression tests

- `npm ci` then `npx prisma validate` (both configs) and `npx prisma generate`.
- Backend: `tsc` build and type check, the **full Jest suite** (currently 17+ suites, including the isolated-SQLite integration specs for availability, bookings, payouts and vehicle documents), and the e2e test.
- **Playwright:** `npm run test:web` (36 browser tests across the three panels).
- **PostgreSQL:** apply all migrations to a disposable PostgreSQL 15 container (`prisma migrate deploy --config prisma.postgres.config.ts`), then run `migrate diff` against `postgresql/schema.prisma`. Smoke-test the API with `DATABASE_URL=postgres://…` covering booking create, concurrent booking conflict, payout create and P2002 → 409.
- A spot check that `HoldExpiryService`'s guarded `updateMany` with the `payment: { is: null }` relation filter behaves the same on both providers.

## 6. Backup and rollback

- Before the change, record `package.json`, `package-lock.json` and the generated client version (`npx prisma -v`).
- The upgrade is a lockfile and `package.json` change only. **No schema or migration changes are planned.** If a migration becomes necessary, it needs its own plan.
- Database backups before any environment is touched: `pg_dump -Fc` of the target database, plus an RDS snapshot in AWS. Local SQLite: copy `portal.db`.
- Rollback: restore the previous `package.json` and `package-lock.json`, run `npm ci`, run `prisma generate`, and redeploy. Because no schema changes are planned, no database rollback should be required.

## 7. Staged validation before any production proposal

1. A local branch: upgrade, `npm ci`, generate, then the full Jest suite, e2e and Playwright.
2. A local PostgreSQL container: migrations, diff and the API smoke test above.
3. `npm audit` comparison: record exactly which advisories are cleared and which remain.
4. A written result for approval. Production or staging changes only after separate authorisation.
