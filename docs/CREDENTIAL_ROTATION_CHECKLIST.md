# Credential Rotation Checklist

| | |
|---|---|
| Rotation status | **BLOCKED / OUTSTANDING (not performed, not verified).** See §7. No rotation has been performed or verified by this work. This is a release blocker. Re-checked 2026-10-12 (Phase 8). |
| Prepared | 2026-10-11 (Phase 5); revised 2026-10-12 (Phase 8) |
| Who | The account owner (Sandbox.co.in dashboard, deployment secret store). Code changes cannot rotate these. |

## 1. What is exposed

Evidence comes from `npm --prefix apps/backend run secrets:scan-history`, which is read-only and prints only paths, rules and commit hashes.

| Credential | Where it appears | Public? | Detection rule |
|---|---|---|---|
| Sandbox.co.in **live** API key | `scripts/test-fetch-files.js`, `scripts/test-sandbox-session.js` in commit `0e6e599` | **Yes**, on `origin/main` (GitHub) | `sandbox-credential`, `exposed-secret-fingerprint` |
| Sandbox.co.in **live** API secret | same files | **Yes** | same |
| JWT signing secret (96 hex characters) | `scripts/test-approval.js`, `scripts/test-doc-evidence.js` in `0e6e599` | **Yes** | `jwt-literal-secret`, `exposed-secret-fingerprint` |

**Not exposed:**
- `DOCUMENT_ENCRYPTION_KEY` and `PAYOUT_ENCRYPTION_KEY`, which are generated per environment and never committed.
- Database passwords. `docker-compose.yml` contains a local placeholder only and must not be used beyond a local machine.

**The working tree is clean:** the deleted scripts are gone, and the repository secret test passes.

## 2. Rotation steps

Do these in order. **Never paste a secret into a ticket, chat, commit or log.**

**Sandbox.co.in API key and secret**
1. In the Sandbox dashboard, create a new live key pair.
2. Store it only in the server secret store (AWS Secrets Manager or SSM Parameter Store for the planned EC2 deployment) as `SANDBOX_API_KEY` and `SANDBOX_API_SECRET`.
3. Deploy or restart the API with the new values.
4. Verify with a test DigiLocker session start in the live environment. Expect `POST /api/kyc/sessions` to return an authorization URL.
5. **Revoke the old key pair** in the dashboard.
6. Confirm the old key now fails, using the provider's dashboard or API key status. Do not test by pasting the old key anywhere.
7. Review the Sandbox usage and billing history for unexpected calls since 2026-10-03, the date of the initial commit.

**JWT signing secret**
1. Check whether any deployed environment's `JWT_SECRET` equals the leaked value. Compare SHA-256 fingerprints, never the values: on the server, run `printf %s "$JWT_SECRET" | sha256sum` and compare with `52f28145…332d`.
2. Whether it matches or not, generate a new secret (`openssl rand -hex 48`) and store it in the secret store.
3. Restart the API. **Every existing session is invalidated** and users must sign in again. Plan the timing.
4. Verify that an old session cookie returns 401 on `GET /api/auth/profile`.

**Local developer machines**
- **Recommended:** regenerate local `.env` keys with `node scripts/setup.js` on a fresh `.env`.
- **Required check:** `npm --prefix apps/backend test -- repository-secrets` passes. It fingerprints local `.env` files against the three leaked values, so a passing run means none of them is still configured locally.

## 3. After rotation

- [ ] Record in the release notes who rotated what, and when. Record no values.
- [ ] Decide whether to rewrite Git history (`docs/GIT_HISTORY_CLEANUP_PLAN.md`). It needs separate explicit approval, and rotation must come first.
- [ ] Keep the leaked fingerprints in `apps/backend/scripts/secret-detectors.cjs` permanently, so the old values can never be reintroduced unnoticed.
- [ ] `npm --prefix apps/backend run secrets:scan-history` keeps reporting the 4 historical files until history is rewritten. That is expected, and is not a sign the rotation failed.

## 4. What the automated checks do and do not prove

| Check | Proves | Does not prove |
|---|---|---|
| `repository-secrets.spec.ts` | The working tree has no Sandbox credentials, hardcoded JWT secrets or known-leaked values, including in local `.env` files. No `.env`, key or database file is tracked. | That the providers revoked anything. |
| `scan-git-history.cjs` | Which commits and paths still contain findings (currently 4 files in `0e6e599`). | Anything about other clones or forks, or GitHub caches. |
| `npm --prefix apps/backend run secrets:scan-history -- --repo <path>` | The same for another local repository or mirror, such as a rewritten mirror before publishing. | Anything about the remote until it is cloned again. |

## 5. Detection verified (Phase 8, 2026-10-12; no values printed)

- **History:** each of the three exposed fingerprints matches a value in the historical files (2 files each).
- **Formats:** the detectors flag every one of those values in all the forms tested, both as a local `.env` file and in code:
  - `JWT_SECRET=<v>`
  - `export SANDBOX_API_KEY="<v>"`
  - `SANDBOX_API_SECRET='<v>' # note`
  - a bare `X=<v>`
- **No false alarm:** a freshly generated secret in a local `.env` is not flagged, so a correctly rotated machine passes.
- **This machine:** `repository-secrets.spec.ts` passes 7/7, so none of the three leaked values is configured in a local `.env` here.
- **Scope:** this proves detection only. It says nothing about whether the provider revoked the old key or whether a deployed server still uses the old JWT secret.

## 6. Rotation verification record (to be completed by the account owner)

Record dates, names and evidence locations only, never values. Until every row is complete, rotation counts as **outstanding**.

| Step | How it is verified | Status |
|---|---|---|
| New Sandbox key pair issued and stored only in the secret store | Secret store audit log shows the update; the API starts with the new values | Outstanding |
| New Sandbox key works | `POST /api/kyc/sessions` returns an authorization URL in the live environment | Outstanding |
| **Old Sandbox key pair revoked** | Provider dashboard shows the old key as revoked or deleted; key status checked in the dashboard, never by using the old key | Outstanding |
| Sandbox usage reviewed since 2026-10-03 | Billing and usage history shows no unexplained calls | Outstanding |
| No environment uses the leaked JWT secret | On each server: `printf %s "$JWT_SECRET" | sha256sum` does **not** start with `52f28145` | Outstanding |
| **New JWT secret deployed; old sessions invalidated** | A session cookie issued before the change gets 401 from `GET /api/auth/profile` | Outstanding |
| Developer machines clean | `npm --prefix apps/backend test -- repository-secrets` passes on each machine | Passes on this machine (2026-10-12); other machines unknown |
| History cleanup decided | `docs/GIT_HISTORY_CLEANUP_PLAN.md` approved or explicitly declined; execution follows `docs/history-cleanup/EXECUTION_CHECKLIST.md` | Prepared (Phase 9); approval and execution outstanding |

## 7. Remediation readiness review (Phase 11, 2026-10-12)

**Status: BLOCKED** until the account owner supplies the evidence in §6. Nothing has been rotated, revoked or tested against an external service as part of this work.

### 7.1 Credential inventory (names only, never values)

| # | Credential | Service | Configuration variable | Used by | Effect of replacing it |
|---|---|---|---|---|---|
| 1 | Sandbox.co.in live API **key** | Sandbox.co.in (DigiLocker KYC provider) | `SANDBOX_API_KEY` (with `SANDBOX_ENV`) | `src/kyc/sandbox.service.ts` | KYC sessions use the new key pair from the next restart. Nothing user-facing is invalidated. |
| 2 | Sandbox.co.in live API **secret** | same | `SANDBOX_API_SECRET` | same | Rotated together with #1, as a pair |
| 3 | JWT signing secret | This API (session cookies) | `JWT_SECRET` | `src/auth/auth.module.ts` (tokens expire after 8 h); startup check in `src/main.ts` | **Every existing session becomes invalid** at the restart, and users sign in again |

The three are listed separately in §1, §2 and §6, and each has its own fingerprint in `scripts/secret-detectors.cjs`. The Sandbox key and secret are one key pair at the provider, but each is checked individually.

### 7.2 Safe replacement configuration

- **Where the new values go:** only in the deployment secret store (AWS Secrets Manager or SSM Parameter Store for the EC2 plan), injected as environment variables. Never in the repository, `.env.example`, tickets, chat, logs or release notes. Local developer `.env` files are gitignored, and `repository-secrets.spec.ts` fails if one is ever tracked.
- **JWT secret:** generate it with `openssl rand -hex 48`. The API refuses to start if `JWT_SECRET` is missing, shorter than 32 characters or a `replace-…` placeholder.
- **Sandbox key pair:** issue it in the Sandbox dashboard. Store both values at the same moment so the API never runs with a mismatched pair.
- **Do not reuse values across environments** (local, staging, production).

### 7.3 Restart requirements

- Restart **every** API instance after updating the secret store. Environment variables are read only at start-up.
- For the JWT secret, all instances must switch together. Instances running different secrets would reject each other's sessions.
- Plan the JWT restart for a low-traffic window and tell users they will need to sign in again.

### 7.4 Verification, by the owner, recording no values

| Check | Expected evidence |
|---|---|
| The API starts with the new values | Start-up log without the `Set a random JWT_SECRET` error; `GET /api` returns 200 |
| The new Sandbox key pair works | In the live environment, `POST /api/kyc/sessions` returns an authorization URL |
| **The old Sandbox key pair is revoked** | The Sandbox dashboard shows the old key as revoked or deleted, identified by the provider's key id or last characters. Record the dashboard entry or a screenshot with the values masked. **Never test by calling the API with the old key.** |
| No unexpected use of the old key | Sandbox usage and billing history since 2026-10-03 shows only expected calls |
| The leaked JWT secret is not configured anywhere | On every server, `printf %s "$JWT_SECRET" \| sha256sum` must **not** start with `52f28145`. Record "does not match", never the hash of the new value. |
| **Old sessions are invalidated** | A cookie captured before the restart gets `401` from `GET /api/auth/profile`. Tokens issued under the leaked secret would expire within 8 h anyway, but the restart invalidates them immediately. |
| Developer machines are clean | `npm --prefix apps/backend test -- repository-secrets` passes on each machine |

### 7.5 Values not present in artifacts (checked 2026-10-12)

- The detectors (Sandbox formats, JWT literals and assignments, and the three exposed fingerprints) found **0 findings** in all 14 text files under `docs/` and in `apps/backend/.env.example`. The `.env.example` Sandbox entries are empty.
- No replacement secret exists yet, so none can appear in any log or report. The procedure above never asks for one to be written down.
