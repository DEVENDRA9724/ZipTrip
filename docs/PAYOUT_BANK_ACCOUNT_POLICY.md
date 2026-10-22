# Payout Bank-Account Change Policy and Destination Security

| | |
|---|---|
| Status | **Implemented locally in Phase 4B (2026-10-11). Not committed or deployed.** |
| Policy source | Business decisions confirmed in the Phase 4 brief |
| Code | `apps/backend/src/payouts/payouts.service.ts`, `payouts.controller.ts`, `prisma/schema.prisma` |
| Migration | `prisma/postgresql/migrations/202610110001_payout_destination_security/migration.sql` (SQLite: `prisma db push`) |
| Tests | `src/payouts/payouts.integration.spec.ts` (9), `scripts/verify-migrations.mjs` (10), `tests/web/fleet-payouts.spec.ts` (Playwright) |

## 1. Confirmed policy, and how each point is enforced

| # | Policy | Enforcement (service layer) |
|---|---|---|
| 1 | Hosts may change their bank details | `POST /payouts/account` (HOST, DEALER, or ADMIN for their own fleet). The target is always the signed-in user; any `userId`/`accountId` in the body is ignored. |
| 2 | A change must be re-verified | A real change of holder, bank, IFSC or account number:<br>• increments `revision`;<br>• sets `status=PENDING`;<br>• records `changedById`/`changedAt`;<br>• clears `reviewedById`, `reviewedAt` and `verifiedRevision`.<br>An identical resubmission (compared by keyed HMAC fingerprint, ignoring case and spacing) changes nothing. |
| 3 | Pending payouts are held until the new account is verified | `PROCESSING` and `PAID` require `destinationVerified(account)`: `status = VERIFIED`, `verifiedRevision = revision`, and a fingerprint is present. New payouts also require it. |
| 4 | Every payout keeps an immutable destination snapshot | Captured at creation (and on reissue) from the verified account. Ordinary updates only write `status`, `reference` and `processedAt`. |
| 5 | Verification needs a second approver, different from the initiator | `POST /payouts/accounts/:id/status` requires ADMIN, **and** the reviewer must be neither the account owner nor `changedById`, **and** `revision` in the request must equal the current revision. |
| 6 | No `PROCESSING`/`PAID` while the destination is unverified or blocked | See the state rules in §2. Each refused attempt writes `PAYOUT_BLOCKED_UNVERIFIED_DESTINATION`. |
| 7 | `PAID` needs a UTR | Phase 3 rule kept: the UTR must be in the same request. A blank value never erases a stored reference. |

## 2. State machines

**Payout account (bank details)**
```
            host saves new details (revision+1)
   ┌─────────────────────────────────────────────────────┐
   ▼                                                     │
PENDING ──second admin, same revision──▶ VERIFIED ───────┤
   │                                         │           │
   └──second admin──▶ REJECTED ◀─────────────┘ (admin revoke → PENDING)
```
- **Unchanged resubmission:** no transition. It writes the audit entry `PAYOUT_ACCOUNT_RESUBMITTED_UNCHANGED`.
- **Stale approval:** if the request's revision is not the current revision, the server returns 409 ("changed after you opened them").
- **Duplicate or concurrent approvals:** the update is guarded on (`revision`, `status`, `changedById`), so exactly one succeeds and exactly one `PAYOUT_ACCOUNT_VERIFIED` audit row is written.

**Payout destination check, applied when moving to `PROCESSING` or `PAID`**

| Check | Blocked reason |
|---|---|
| `destinationState ≠ CAPTURED` | `RECONCILIATION_REQUIRED` |
| snapshot fingerprint missing | `SNAPSHOT_INCOMPLETE` |
| account not verified for its current revision | `ACCOUNT_UNVERIFIED`: the host changed details and a second approval is pending |
| from `PENDING`: account's verified fingerprint ≠ snapshot fingerprint | `DESTINATION_SUPERSEDED`: the host's new details are verified, but this payout was created for the old ones |

From `PROCESSING` the transfer has already been sent to the snapshot destination. Recording `PAID` therefore only requires that no unverified change is pending; it is not blocked as superseded.

**Reconciliation** (`POST /payouts/:id/reconcile`, admin, not the account owner)
- **Applies to:** `PENDING` or `FAILED` payouts that are `RECONCILIATION_REQUIRED` or superseded. A payout that is `PROCESSING` must first be recorded as `FAILED`.
- **`CANCEL`:** sets the payout to `CANCELLED`.
- **`REISSUE`:** cancels the payout and, in the same transaction, creates a replacement with the same amount, period and note, snapshotted against the current *verified* destination.
- **Snapshots are never edited.** The original payout keeps its snapshot or its legacy state.
- **Audit:** `PAYOUT_RECONCILED`, recording the decision, the reason and the replacement id.

## 3. Schema (additive)

**`PayoutAccount`:** adds `revision` (int, default 1), `fingerprint`, `changedById`, `changedAt`, `reviewedById`, `reviewedAt`, `verifiedRevision`.

**`Payout`:**
- **New fields:** `destinationState` (default `RECONCILIATION_REQUIRED`), `destinationAccountHolderName`, `destinationBankName`, `destinationIfscCode`, `destinationAccountNumberLast4`, `destinationEncryptedAccountNumber`, `destinationFingerprint`, `destinationAccountRevision`, `destinationCapturedAt`.
- **New index:** `@@index([destinationState])`.

**Why a migration was necessary:** the existing single, mutable account row could not record who initiated a change, which revision a reviewer approved, or where an existing payout was meant to go.

## 4. Data protection

**Account numbers:**
- Stored only with the existing AES-256-GCM scheme, under `PAYOUT_ENCRYPTION_KEY` or, failing that, `DOCUMENT_ENCRYPTION_KEY`.
- The snapshot stores a copy of the same ciphertext. There is no new encryption scheme.

**Fingerprints:** `v1:` + HMAC-SHA256, using a key derived from the payout encryption key over the normalised destination. Without the key, a fingerprint cannot be used to recover or brute-force the account number.

**What leaves the server:**
- **Responses:** `encryptedAccountNumber`, `fingerprint`, `destinationEncryptedAccountNumber` and `destinationFingerprint` are stripped from every API response (host and admin lists, account views, create/update/reconcile results). Only the last four digits, IFSC, bank and holder are returned.
- **Audit and logs:** entries contain the last four digits, IFSC, revision and actor ids, never full numbers or ciphertext. The integration test scans all responses, audit rows and captured stdout/stderr for full numbers and ciphertext.
- **Exports:** there is no payout export.

**Remaining gaps:**
- No workflow currently reveals a full account number to anyone, so manual bank transfers still need the details from outside the system. This was already the case before Phase 4. If a reveal is needed, it should be a separate admin-only, audited endpoint.
- If the encryption key is rotated, both account rows and payout snapshots will need re-encryption.

## 5. Migration and legacy data

**PostgreSQL migration (`202610110001_payout_destination_security`):**
- Adds the columns.
- Backfills accounts with `changedById = userId` and `changedAt = updatedAt`. `verifiedRevision` stays NULL, so **existing accounts must be re-verified** under the new rules. Their historical `status` value is not rewritten.
- **Does not copy** the current account details into old payouts.
- Sets `PENDING`, `PROCESSING` and `FAILED` payouts to `RECONCILIATION_REQUIRED`, and `PAID` and `CANCELLED` payouts to `LEGACY_UNVERIFIED`.
- Leaves ids, amounts, statuses, references and timestamps unchanged.

**SQLite (`prisma db push`):**
- Adds the same columns with the safe default `RECONCILIATION_REQUIRED` for every existing payout, including final ones. That is harmless: final payouts cannot be reconciled or processed.
- There is no data backfill in this path.

**Verified with `npm run db:verify-migrations`:**
- the full migration chain was applied to a disposable PGlite (PostgreSQL) database with synthetic legacy payouts;
- a disposable SQLite `db push` was run;
- 10 of 10 checks passed, covering preserved fields, the backfill, schema parity, indexes, foreign keys, idempotent re-runs, and rows written by the previous application version.

**Legacy payouts in this repository's development database:** none. The dev `portal.db` had 0 payout accounts and 0 payouts when inspected read-only.

## 6. Rollback

1. **Application rollback (preferred):** redeploy the previous build. The new columns are nullable or defaulted, so the old code keeps working against the migrated schema. This was verified by an insert in the old row shape.
   - **Warning:** the old code ignores destination snapshots and holds. Roll back only with payouts paused.
2. **Do not drop the new columns in production.** Dropping them would delete destination snapshots and verification history. If a schema rollback is ever unavoidable, first take `pg_dump -Fc` and an RDS snapshot, and export the payout and account tables. Never delete payout rows.
3. **Local SQLite:** keep a copy of `portal.db` before `db push`. Restoring that copy is the rollback.

## 7. Applying this locally

The local development database (`apps/backend/portal.db`) was **not** modified in Phase 4. Before restarting the dev server with the new build:
```bash
cp apps/backend/portal.db apps/backend/portal.backup.db   # backup
npm --prefix apps/backend run db:push                     # adds the new nullable/defaulted columns
```
