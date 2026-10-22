# Release Readiness: Phase 11

| | |
|---|---|
| Date | 2026-10-12 |
| Repository state | Branch `new-change`, HEAD `79a1280` (unchanged since Phase 0). All work is local and unstaged. |
| Phase 10 | No `RELEASE_READINESS_PHASE10.md` existed. The Phase 10 brief ended after Step 0: the baseline was re-verified (all checks passed) and no further Phase 10 steps were defined. This document reconciles and supersedes it. |
| Conclusion | **CONDITIONALLY READY FOR OWNER REVIEW.** All local checks pass; the external security actions and owner authorizations below remain. |

Statuses: **PASS**, **FAIL**, **BLOCKED** (needs an owner or external action), **NOT VERIFIED** (not checkable locally or not run), **NOT APPLICABLE**.

## 1. Local code readiness

All checks below were executed on 2026-10-12 after the Phase 11 changes, with Node v22.23.3, npm 10.9.9 and git 2.56.0. Tests that write data used scratch or disposable databases.

| Area | Check | Status | Evidence |
|---|---|---|---|
| Build | `tsc -p tsconfig.build.json` (tsbuildinfo kept in scratch) | PASS | No errors |
| Typecheck | `tsc --noEmit` | PASS | No errors |
| Unit and integration | Jest | PASS | 22 suites / 154 tests |
| End to end | Jest e2e on a scratch SQLite DB with a throwaway JWT secret | PASS | 1/1 |
| Browser | Playwright (`npm run test:web`, isolated DB on port 3100) | PASS | 50/50 |
| Migrations | `db:verify-migrations` (PGlite and SQLite, disposable) | PASS | 22/22, including the backfill and the Option A relabel with decoys |
| Prisma | `prisma validate` (SQLite and PostgreSQL configs), `prisma generate`, read-only `migrate diff` against the local DB | PASS | Both valid; client v7.8.0 generated; "No difference detected" |
| Lint | ESLint compared with the recorded Phase 5 baseline (1,841) | PASS | 1,808 problems, all pre-existing; 0 new; no file or rule above baseline; unchanged since Phase 10 |
| Secret tests | `repository-secrets.spec.ts` | PASS | 7/7. No leaked value in the working tree or local `.env`; no `.env`, key or DB file tracked |
| Local DB integrity | 14 read-only checks on `apps/backend/portal.db` | PASS | 14/14 |
| Legacy admin `{status:'ACTIVE'}` | Code review and regression tests | PASS (after fix) | See §2 |

## 2. Legacy activation request (Phase 11 finding)

**Finding.** On a car that was revoked, so pending under a `REVIEW_REQUIRED` hold, `POST /admin/vehicles/:id/review {status:'ACTIVE'}` approved and reactivated it in one request. That bypassed the "separate explicit reactivation" requirement of decision D1. The same applied to the 6 demo cars, which are pending under the review hold. Authorization (admin only, not the owner) and compliance (re-checked by both approval and activation) were **not** bypassed.

**Fix** (`src/admin/admin.controller.ts`). The legacy `ACTIVE` request on a car that is not approved and is under any administrative restriction is refused with 409 and `reasons: ['RESTRICTED_<reason>']` before anything changes. On an already approved car it remains the explicit reactivation by a non-owning administrator, with all checks.

**Proof** (`vehicle-approval.integration.spec.ts`, test "the legacy {status: ACTIVE} request cannot bypass…"):
- The shortcut is refused with no state or audit change, for a revoked car, a demo-style held car and a suspended pending car.
- Host and owning-admin requests are refused.
- After `APPROVE` the hold remains.
- The legacy reactivation is refused while a document is expired, and succeeds once it is valid.
- A pending car with no restriction still approves and lists, as before.

**Mutation check.** With the guard disabled the test fails; with it restored (byte-for-byte) it passes. The live local server returns 409 for a demo car, and the DB integrity checks still pass.

## 3. Vehicle compliance and booking readiness

| Requirement | Status | Evidence |
|---|---|---|
| Revocation makes the car inactive with a review hold | PASS | `REVOCATION_HOLD`; tests for admin revoke and document rejection |
| Re-approval does not reactivate | PASS | Test "re-approval after a revocation does not relist the car" |
| Only a non-owning admin can lift a restriction; activation re-checks current RC, Insurance and PUC | PASS | `setAvailability` capacity rules; Phase 7 and Phase 9 tests; legacy path (§2) |
| Owners cannot bypass admin restrictions | PASS | 403 `RESTRICTED_*`; an owner pause never replaces an admin reason (Jest and Playwright) |
| Listing, detail, quote, booking creation and payment recording enforce one eligibility rule | PASS | `bookableVehicleWhere` / `vehicleEligibility` at every call site; matrix and D3 tests |
| Existing bookings, payments and active trips preserved; flags and audit rows idempotent | PASS | D4 and Phase 7 tests (bookings and payments deep-equal before and after; one flag per booking and reason) |
| Real compliance evidence for listing | **BLOCKED** | The 6 local demo cars are `PENDING_APPROVAL` / `INACTIVE` / `REVIEW_REQUIRED` and not publicly bookable (`GET /api/vehicles` returns `[]`). Their 20 documents are unverified `DEMO_SEED` records with no evidence file. Nothing was fabricated or approved. Real RC, Insurance and PUC files must be uploaded and reviewed by an administrator. |
| Pickup of an already confirmed booking re-checks compliance | NOT VERIFIED / by design | Under D4, existing bookings are preserved. Pickup (`CONFIRMED → ACTIVE`) does not re-check documents; affected upcoming bookings are listed as review flags for an administrator. Whether pickup should be blocked when, for example, insurance lapses after confirmation is an owner decision. |

## 4. Dependencies and application security

| Item | Status | Evidence |
|---|---|---|
| `deepmerge-ts` resolves to 8.0.2 (override); Prisma CLI and `@prisma/client` at 7.8.0 | PASS | `npm ls` |
| Prisma config loading, validation, generation, migrations with the override | PASS | §1; Phase 9 loader probe |
| Backend audit | PASS (with an accepted residual) | 20 moderate, 0 high, 0 critical. All from one advisory, `sprintf-js` GHSA-hp3w-g68c-fv3c: no patched release exists; development-only (ts-jest → … → js-yaml@3 → argparse@1); not in the production tree; `argparse` is loaded only by js-yaml's CLI binary, which nothing runs |
| Production-only audit (`--omit=dev`) and root audit | PASS | 0 and 0 |
| CSP and headers | PASS | Live local server: `script-src 'self'; script-src-attr 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. 0 inline scripts, inline handlers or `javascript:` URLs in `apps/web/*.html`. Playwright CSP tests pass. |
| DOM escaping, upload validation, media access, authentication and authorization | PASS (tests) | Playwright security, admin, owner and customer specs (XSS payloads, SVG/PDF/oversize rejection, private-media and blocked-user denial); Jest authorization tests |
| Safe logging | PASS | 1 `console.log` (start-up banner); none of the 7 logger calls logs passwords, secrets, tokens or cookies; converter errors are redacted (Phase 2) |
| Zero residual security risk | NOT CLAIMED | Credential exposure (§5) remains, and `sprintf-js` is accepted as a development-only residual. No penetration test or production review was done. |

## 5. External security actions

| Item | Status | Evidence / required owner action |
|---|---|---|
| Historical credential exposure | **FAIL (known, unchanged)** | The read-only scan finds 4 files in commit `0e6e599` (Sandbox live key and secret, JWT signing secret). Values are never printed. They are public on `origin/main`. |
| Credential rotation and revocation | **BLOCKED** | `docs/CREDENTIAL_ROTATION_CHECKLIST.md` §6–7: names, services, safe replacement, restart, verification and old-session invalidation are documented. **Owner action:** rotate all three, revoke the old Sandbox key pair, deploy a new JWT secret and complete the §6 evidence record. |
| History-cleanup readiness | PASS (prepared) / **BLOCKED (execution)** | `docs/history-cleanup/`: path evidence (4 scanner-backed, 3 personal data); a fail-closed verifier with 6 tests on synthetic clean and unsafe repositories; a checklist separating revocation (A1) from rewriting, with owner authorization (A2), collaborators, forks, clones and backup safety. **Owner action:** complete A1–A8, then execute with explicit authorization. No backup was created and no rewrite was run. |
| Artifacts free of secret values | PASS | 0 detector findings across 14 doc and example files; the verifier tests assert their runtime-generated fake key never appears in output |

## 6. Database and recovery readiness

| Item | Status | Evidence |
|---|---|---|
| Local DB integrity and expected state | PASS | 14/14 (6 cars held, 20 unverified demo documents, customer unverified, audit rows exactly one per record) |
| Backup and restore procedure | PASS | `docs/LOCAL_DATABASE_RECOVERY.md`. Restore rehearsed in Phase 7 (byte-identical); backups gitignored and untracked |
| Migration safety | PASS | Additive migrations; verified on disposable PGlite and SQLite; no `--accept-data-loss` |
| Production database (PostgreSQL/RDS) migration and backup | NOT VERIFIED | Not performed. Needs `pg_dump` and an RDS snapshot before `db:pg:deploy` (`docs/LOCAL_DATABASE_RECOVERY.md` §6) |

## 7. Production configuration and operational readiness

| Item | Status | Notes |
|---|---|---|
| Production secrets in a secret store | NOT VERIFIED | Depends on rotation (§5) |
| Production environment (AWS EC2 and RDS), TLS, `TRUST_PROXY`, `BUSINESS_*` settings, monitoring, log retention | NOT VERIFIED | Not in local scope |
| Mobile app (`apps/mobile`) | NOT APPLICABLE | Out of scope and untouched |

## 8. Owner authorizations required

| Authorization | Status |
|---|---|
| Stage, commit and push the Phase 0–11 work | BLOCKED: not authorized |
| Credential rotation and revocation (external accounts) | BLOCKED: owner action |
| History-cleanup execution (backup, rewrite, force-push) | BLOCKED: after rotation, with written authorization |
| Release or deployment | BLOCKED: after all of the above |

## 9. Phase 11 changes (separate from the pre-existing 106 changed paths)

**New:**
- `apps/backend/src/common/history-cleanup-verifier.spec.ts`
- `docs/RELEASE_READINESS_PHASE11.md`

**Edited (already-changed files):**
- `apps/backend/src/admin/admin.controller.ts`: legacy `ACTIVE` guard.
- `apps/backend/src/vehicles/vehicle-approval.integration.spec.ts`: legacy-path test.
- `docs/history-cleanup/verify-rewrite.cjs`: fail-closed inputs, unexpected-ref gate, error handling.
- `docs/history-cleanup/EXECUTION_CHECKLIST.md`: path evidence, backup safety, `--replace-refs delete-no-add`.
- `docs/GIT_HISTORY_CLEANUP_PLAN.md`: flag and backup pointer.
- `docs/CREDENTIAL_ROTATION_CHECKLIST.md`: §7 readiness review, BLOCKED status.
