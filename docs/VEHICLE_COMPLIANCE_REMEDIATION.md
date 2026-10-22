# Vehicle Compliance Records: Findings and Remediation Plan

| | |
|---|---|
| Status | **Plan only. No existing records were changed.** Requires approval before any data remediation. Record-level report added in Phase 5 (§6–7). |
| Prepared | 2026-10-11 (Phase 4A) |

## 1. What was fixed in code (Phase 4A)

**`POST /admin/vehicles` no longer:**
- creates 8 fake `Media` rows (`storageKey` like `fleet-<id>-<kind>.jpg` with no file on disk);
- creates RC, Insurance and PUC `Document` rows already `APPROVED` (`source = ADMIN_FLEET_UPLOAD`, 3-year validity, no evidence);
- lists the car as `ACTIVE` immediately.

**Admin-created cars now:**
- Use the same validation as host listings (`VehiclesService.createByAdmin`).
- Start as `PENDING_APPROVAL`.
- Link only real uploaded photos (optional at creation). Missing angles can be added while the listing is pending via `POST /vehicles/:id/photos`.
- Get documents only through the normal upload flow, starting `PENDING`.
- Can only go live through `POST /admin/vehicles/:id/review` by a **different** administrator. That review requires all 8 photo angles plus RC, Insurance and PUC approved from viewed evidence.

**Also:**
- Administrators can no longer review documents they submitted themselves.
- The demo seeder (`scripts/seed.js`) now labels its unverified approvals `source = DEMO_SEED`, uses notes saying "Demo seed data — not verified", and refuses to run when `NODE_ENV=production` or against PostgreSQL.

## 2. Existing records found (read-only inspection of `apps/backend/portal.db`, 2026-10-11)

| Record type | Count | Origin |
|---|---|---|
| Vehicles created by the admin endpoint (`VEHICLE_CREATED_BY_ADMIN` audit / admin-hosted cars) | **0** | – |
| Fake fleet media rows (`storageKey LIKE 'fleet-%'`) | **0** | – |
| Media rows whose file is missing | **0** | – |
| Auto-approved fleet documents (`source = ADMIN_FLEET_UPLOAD`) | **0** | – |
| `APPROVED` vehicle documents with **no evidence file** | **18** (6 RC, 6 INSURANCE, 6 PUC, labelled `HOST_UPLOAD`) | Demo seeder before Phase 4 |
| `APPROVED` customer documents with no evidence file | **2** (1 AADHAAR, 1 DL, labelled `DIGILOCKER_LIVE`) | Demo seeder before Phase 4 |

These 20 rows make the 6 demo cars and the demo customer look verified. They are local demonstration data, not production records. Other environments (any shared database or production) have **not** been inspected and must be checked with the queries below before release.

## 3. Detection queries (read-only)

```sql
-- Fake media rows and admin-fabricated documents (pre-Phase-4 admin endpoint)
SELECT COUNT(*) FROM "Media" WHERE "storageKey" LIKE 'fleet-%';
SELECT COUNT(*) FROM "Document" WHERE "source" = 'ADMIN_FLEET_UPLOAD';
-- Approved compliance with no evidence file, by source
SELECT "source", "kind", COUNT(*) FROM "Document" WHERE "status" = 'APPROVED' AND "mediaId" IS NULL GROUP BY 1, 2;
-- Active cars whose RC/Insurance/PUC approval has no evidence
SELECT DISTINCT v."id", v."registrationNumber" FROM "Vehicle" v JOIN "Document" d ON d."vehicleId" = v."id"
WHERE v."status" = 'ACTIVE' AND d."status" = 'APPROVED' AND d."mediaId" IS NULL;
```

## 4. Proposed remediation (needs approval; not executed)

1. **Back up first:** `pg_dump -Fc` and an RDS snapshot in shared environments; a copy of `portal.db` locally.
2. **For each affected document:** set `status = 'PENDING'` and a `reviewNote` such as "Evidence missing — re-upload required", with an `AuditLog` row (`DOCUMENT_EVIDENCE_REVOKED`, actor `SYSTEM` or the approving admin). Do not delete the document.
3. **For each affected `ACTIVE` car:** set `status = 'PENDING_APPROVAL'` with an audit row. Confirmed future bookings on those cars need a business decision: honour them, or contact the customers. Do not cancel bookings automatically.
4. **Fake media rows (`fleet-%`):** unlink them by setting `vehicleId = NULL`, or delete them after the backup. They have no files, so no evidence is lost. Record the counts in the audit log.
5. **Local demo data:** either re-seed a fresh local database with the new `DEMO_SEED` labels, or leave it as-is. Its status is documented here.

## 5. Out of scope / decisions needed

- **Separate approval and availability states.** Vehicle approval and availability still share one enum (`PENDING_APPROVAL | ACTIVE | INACTIVE | MAINTENANCE`), and there is no `DRAFT` or `REJECTED` state. In the current code:
  - `ACTIVE` is the only listed state;
  - moving to `ACTIVE` always re-checks photos and approved, unexpired compliance evidence;
  - `INACTIVE` and `MAINTENANCE` hide a car without deleting its approval evidence.

  Fully separating approval from availability (for example a new `approvalStatus` column plus `DRAFT` and `REJECTED`) needs a migration, a backfill, and product decisions: what "rejected" means versus "inactive", and whether hosts may toggle availability themselves. That is **not** done in Phase 4, and is listed as a decision needed.

## 6. Record-level report (Phase 5 re-inspection, 2026-10-11, read-only)

Source: the local `apps/backend/portal.db`. A verified backup was taken first; see `docs/LOCAL_DATABASE_RECOVERY.md`.

**Redactions:**
- document IDs are truncated to 8 characters;
- registrations show only the state/RTO prefix and the last two characters;
- no names, emails or document numbers are included.

The stored "Source" labels are the values the old seeder wrote. None of them reflects a real upload or a real DigiLocker retrieval.

| # | Doc id | Kind | Source | Status | Valid until | Owner role | Vehicle (masked reg) | Vehicle status | Bookings on vehicle | Audit rows |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 825f790f… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••33 | ACTIVE | 0 | 0 |
| 2 | aa4f472a… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••33 | ACTIVE | 0 | 0 |
| 3 | 0555c616… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••33 | ACTIVE | 0 | 0 |
| 4 | fae91c2a… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••90 | ACTIVE | 0 | 0 |
| 5 | e0ceccb6… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••90 | ACTIVE | 0 | 0 |
| 6 | 2b97de4f… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••90 | ACTIVE | 0 | 0 |
| 7 | 480b6266… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••44 | ACTIVE | 0 | 0 |
| 8 | aa2a1b55… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••44 | ACTIVE | 0 | 0 |
| 9 | c99720ad… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ01••44 | ACTIVE | 0 | 0 |
| 10 | 0790fea4… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ05••99 | ACTIVE | 0 | 0 |
| 11 | 5d485a79… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ05••99 | ACTIVE | 0 | 0 |
| 12 | 37fd328d… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ05••99 | ACTIVE | 0 | 0 |
| 13 | 18c005d9… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ06••55 | ACTIVE | 0 | 0 |
| 14 | de0ae878… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ06••55 | ACTIVE | 0 | 0 |
| 15 | ef27417d… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ06••55 | ACTIVE | 0 | 0 |
| 16 | 8a80137d… | INSURANCE | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ18••11 | ACTIVE | 0 | 0 |
| 17 | aa940713… | PUC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ18••11 | ACTIVE | 0 | 0 |
| 18 | c4b4538d… | RC | HOST_UPLOAD | APPROVED | 2028-12-31 | HOST | GJ18••11 | ACTIVE | 0 | 0 |
| 19 | 83ea703b… | AADHAAR | DIGILOCKER_LIVE | APPROVED | — | CUSTOMER | (personal KYC) | — | — | 0 |
| 20 | 88665fa0… | DL | DIGILOCKER_LIVE | APPROVED | 2029-12-31 | CUSTOMER | (personal KYC) | — | — | 0 |

total: 20 | distinct vehicles: 6 | review notes: <kind> verified and valid until 2028 / Aadhaar eKYC verified via Sandbox DigiLocker / Driving Licence approved for LMV-NT / Transport class

**Findings:**
1. **No document has any audit history** (0 rows each). None was viewed (`DOCUMENT_VIEWED`) or approved (`DOCUMENT_APPROVED`) through the review workflow. Their `APPROVED` status came directly from the seeder.
2. **Every publicly listed demo car depends on them.** The 18 vehicle documents are the only RC, Insurance and PUC records for all 6 cars, and all 6 are `ACTIVE`. Booking eligibility (`bookings.service.ts`) accepts them because it checks only `status = APPROVED` and `validUntil`.
3. **The demo customer's verification depends on them.** The 2 customer documents are what make the demo customer `isVerified` with a DL valid to 2029.
4. **No bookings** exist on these vehicles, so no booking or trip history depends on them.
5. **Stored labels:** new seeds write `DEMO_SEED` (Phase 4), but these existing rows still carry the old labels (`HOST_UPLOAD`, `DIGILOCKER_LIVE`).

## 7. Remediation options for these 20 records (decision required; nothing changed)

| Option | Effect | Keeps history? | Notes |
|---|---|---|---|
| **A. Re-label only** | `source` changes to `DEMO_SEED` and `reviewNote` to "Demo seed data – no evidence"; status stays `APPROVED`. One audit row each (`DOCUMENT_RELABELLED`). | Yes | Honest labels, but the demo cars stay bookable on unverified documents. Acceptable **only** for a local demo database. |
| **B. Revoke to pending (recommended for any shared or real environment)** | `status` set to `PENDING` with note "Evidence missing – re-upload required". Affected cars go to `PENDING_APPROVAL`; the demo customer's `isVerified` is recomputed (it becomes false). One audit row each (`DOCUMENT_EVIDENCE_REVOKED`, actor `SYSTEM`). | Yes (no deletion) | Matches the policy that approval requires viewed evidence. Demo booking stops working until real documents are uploaded and reviewed by a second admin. |
| **C. Reject** | `status` set to `REJECTED` with the same note and audit. | Yes | Stronger signal than B, but "rejected" implies a reviewer judged the document invalid, which never happened. B is more accurate. |
| **D. Replace with evidence** | The owner uploads real RC, Insurance and PUC (or the customer completes DigiLocker); a different admin reviews them; then the old rows go through B. | Yes | The only path to genuinely approved records. |
| **E. Fresh local database** | Back up, then rebuild the local database with the current seeder (`DEMO_SEED` labels). | Old file kept as backup | Simplest for a purely local demo; it does not remediate in place. |

**Never:** delete these rows, attach invented evidence, or mark them reviewed.

**Recommended:**
- For this local demo database: **A** or **E**.
- For any shared, staging or production database where the detection queries in §3 find matches: **B**, then **D**.
- Run any option only after a fresh `npm run db:backup` and with written approval of the policy.

## 8. Option A applied to the local database (Phase 6, 2026-10-11)

- **Rehearsal.** Ran first on a disposable copy, then on `apps/backend/portal.db` after a verified backup (`backups/portal-2026-10-11T11-47-30-644Z.db`: integrity ok, all 17 tables identical to the source).
- **Script.** `npm run db:relabel-demo-documents` (`scripts/relabel-legacy-demo-documents.cjs`). It aborts without changes unless each of the 20 listed id prefixes matches exactly one approved, evidence-less document owned by a seed account with no review history.
- **Result.** Exactly 20 documents were relabelled `source = DEMO_SEED` with an explicit unverified note. Status stays `APPROVED` and nothing was deleted. 20 `DOCUMENT_RELABELLED_DEMO` audit rows hold the previous source and note. The demo customer's verification was recomputed to unverified (1 `USER_VERIFICATION_RECOMPUTED` row with the previous values).
- **Idempotency.** A second run changed nothing and added no audit rows.
- **Reversal.** Restore the backup, or reset each document's source and note from its audit row.
- **Effect.** Demo and test records can never make a car bookable or verify a customer, and admins cannot approve them. Real evidence must be uploaded and reviewed.
