# Vehicle Approval and Availability: Design and Migration Plan

| | |
|---|---|
| Status | **Implemented locally** in Phase 6 (2026-10-11) and Phase 7 (owner/admin restriction policy). Not committed or deployed. §3 describes the **implemented** behaviour (reconciled with code and tests in Phase 8, 2026-10-12); the Phase 8 revocation discrepancy was resolved by decision D1 in Phase 9 (§9). |
| Prepared | 2026-10-11; reconciled 2026-10-12 |

## 1. Model before Phase 6 (historical; kept for context)

A single `Vehicle.status` enum carries both meanings: `PENDING_APPROVAL | ACTIVE | INACTIVE | MAINTENANCE`.

| Where | Rule today |
|---|---|
| Host listing `POST /vehicles` and admin `POST /admin/vehicles` (`vehicles.service.ts`) | Creates `PENDING_APPROVAL`. Hosts must supply 8 photos; admins may add photos later (`POST /vehicles/:id/photos`, pending only). |
| Review `POST /admin/vehicles/:id/review` (`admin.controller.ts`) | Any of the 4 statuses. The reviewer must be an ADMIN who is not the host. **`ACTIVE` requires** a registration number, all 8 photo angles, and RC/Insurance/PUC `APPROVED` with `validUntil` in the future. Other statuses have no preconditions. |
| Document review | Rejecting a vehicle document sets the car to `PENDING_APPROVAL`. Approving one never changes the car. |
| Public search `GET /vehicles` (`findAll`) | `status = ACTIVE`. Document validity and overlaps are checked **only when dates are supplied**. |
| Detail, quote (`findOne`, `quote`) | `ACTIVE`; quote also checks documents valid through the return date and checks overlaps. |
| Booking `POST /bookings` (`bookings.service.ts`) | `ACTIVE`, not the host's own car, RC/Insurance/PUC `APPROVED` and valid through the return date, no overlap or block, and a verified customer whose DL is valid through the return date. |
| Admin payment recording | Re-checks `vehicle.status === 'ACTIVE'` and customer KYC. |
| Media `GET /media/:id` | Car photos are public only while the car is `ACTIVE`. |
| Owner workflow | Owners **cannot** pause or resume their own car; only admins change status. |
| Seeders and tests | `seed.js` and the Playwright fixtures insert `ACTIVE` cars directly. |

**Gaps this design addresses:**
1. `INACTIVE` and `MAINTENANCE` don't record whether the car was ever approved, so "approved but paused" and "rejected" look the same.
2. There is no `DRAFT` or `REJECTED` state, and no recorded approver or approval time.
3. Document expiry never changes the car. Booking blocks expired documents, but the undated public listing still shows those cars.
4. Owners can't pause availability.
5. A pickup inspection does not re-check that the car is still listed.

## 2. Model (implemented)

**New fields on `Vehicle`** (additive; the old `status` is kept during transition):

| Field | Values | Default |
|---|---|---|
| `approvalStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` | `DRAFT` |
| `availability` | `ACTIVE`, `INACTIVE` | `INACTIVE` |
| `availabilityReason` | `OWNER_PAUSED` (owner-controlled); `ADMIN_SUSPENDED`, `MAINTENANCE`, `REVIEW_REQUIRED` (administrative restrictions, `ADMINISTRATIVE_RESTRICTIONS` in `src/vehicles/vehicle-status.ts`); null = never activated, or active. The proposed `COMPLIANCE_EXPIRED` was not implemented (see D3). | null |
| `approvedById`, `approvedAt` | admin id, timestamp | null |
| `rejectedReason` | text | null |

**Bookable** = `approvalStatus = APPROVED` **and** `availability = ACTIVE` **and** every existing check: RC/Insurance/PUC approved and valid through the return date, no overlap or block, and the customer's KYC and DL are valid. The undated public listing also requires documents valid **today** (fixes gap 3).

## 3. Transition rules (as implemented)

**Where to look:**
- **Code:**
  - `VehiclesService.create/createByAdmin/addPhotos/submit/setAvailability` (`src/vehicles/vehicles.service.ts`)
  - `AdminController.vehicle` and `AdminController.review` (`src/admin/admin.controller.ts`)
- **Tests:**
  - `src/vehicles/vehicle-approval.integration.spec.ts`
  - `vehicle-eligibility.integration.spec.ts`
  - `admin-vehicle-integrity.integration.spec.ts`
  - `tests/web/owner.spec.ts`
  - `tests/web/admin.spec.ts`

**Approval** (`approvalStatus`). Approving or rejecting never changes `availability`. **Revocation does** (decision D1, Phase 9): it forces `INACTIVE` under the `REVIEW_REQUIRED` hold.

| From → To | Who | Preconditions | Side effects |
|---|---|---|---|
| (create) → `PENDING_APPROVAL` | Owner (HOST/DEALER) via `POST /vehicles` | All 8 photo angles and listing fields | `availability = INACTIVE`. No creation audit row (unchanged from before Phase 6). |
| (create) → `PENDING_APPROVAL` or `DRAFT` | ADMIN via `POST /admin/vehicles` (admin's own fleet) | `PENDING_APPROVAL` with all 8 photos, otherwise `DRAFT` | `availability = INACTIVE`; audit `VEHICLE_CREATED_BY_ADMIN` |
| `DRAFT` → `PENDING_APPROVAL` | Owner (`POST /vehicles/:id/submit`), or automatically when `POST /vehicles/:id/photos` completes the photo set | Registration number and all 8 photo angles | Audit `VEHICLE_SUBMITTED` (`automatic: true` when triggered by the photo upload) |
| `REJECTED` → `PENDING_APPROVAL` | Owner (`POST /vehicles/:id/submit`) | Registration number and all 8 photo angles | `rejectedReason` cleared; audit `VEHICLE_SUBMITTED` |
| `PENDING_APPROVAL` → `APPROVED` | ADMIN ≠ owner (`decision: APPROVE`) | Registration number; all 8 photos; RC, Insurance and PUC approved, with evidence file, genuine source and `validUntil` in the future | `approvedById`/`approvedAt` set; audit `VEHICLE_APPROVED`. Availability unchanged: the car is listed only once it is (or becomes) `ACTIVE`. |
| `PENDING_APPROVAL` → `REJECTED` | ADMIN ≠ owner (`decision: REJECT`) | Note required | `rejectedReason` set; audit `VEHICLE_REJECTED`; availability unchanged |
| `APPROVED` → `PENDING_APPROVAL` | ADMIN ≠ owner (`decision: REVOKE`) | Note required | `availability = INACTIVE`, reason `REVIEW_REQUIRED` (`REVOCATION_HOLD` in `vehicle-status.ts`); audit `VEHICLE_APPROVAL_REVOKED` with the previous availability and reason; upcoming bookings flagged `APPROVAL_REVOKED` |
| `APPROVED` → `PENDING_APPROVAL` | Automatic, when an ADMIN rejects one of the car's documents | – | Same review hold (`INACTIVE`, `REVIEW_REQUIRED`); audit `VEHICLE_APPROVAL_REVOKED` (`DOCUMENT_REJECTED`, with the previous availability); upcoming bookings flagged |

- Document **expiry** does not change approval (D3). An expired, missing or unevidenced document makes the car ineligible on every request instead.
- Approving a vehicle document never changes the car.
- An administrator's own listing must be reviewed by another administrator.

**Availability** (`availability` and `availabilityReason`, via `POST /vehicles/:id/availability` or the legacy admin review body):

| From → To | Who | Preconditions | Result |
|---|---|---|---|
| `ACTIVE` → `INACTIVE` | Owner (or an admin acting on their own car) | none | Reason `OWNER_PAUSED` (an owner cannot choose another reason) |
| `ACTIVE` or `INACTIVE` → `INACTIVE` | ADMIN on a car they do not own | none | Reason `ADMIN_SUSPENDED` (default) or `MAINTENANCE`; may replace any other reason |
| `INACTIVE` (administrative reason) → `INACTIVE` | Owner | – | **No change and no audit row.** An owner's pause never replaces an administrative reason. |
| `INACTIVE` (`OWNER_PAUSED` or no reason) → `ACTIVE` | Owner | `approvalStatus = APPROVED` **and** RC, Insurance and PUC compliant now | Reason cleared |
| `INACTIVE` (`ADMIN_SUSPENDED`, `MAINTENANCE` or `REVIEW_REQUIRED`) → `ACTIVE` | **Owner: refused** (403, `reasons: ['RESTRICTED_<reason>']`) | – | Unchanged |
| `INACTIVE` (any reason) → `ACTIVE` | ADMIN on a car they do not own | `approvalStatus = APPROVED` **and** RC, Insurance and PUC compliant now | Reason cleared |

**Every availability change:**
- writes `VEHICLE_AVAILABILITY_CHANGED` with the previous reason and the capacity (`OWNER` or `ADMIN`);
- keeps the legacy `status` in sync;
- never cancels, refunds or edits bookings or payments. Going to `INACTIVE` flags each upcoming booking (confirmed and not started, or a live hold) once per booking and reason (`BOOKING_REVIEW_FLAGGED`, reason `VEHICLE_INACTIVE`).

**Public bookability** (listing, detail, quote, booking creation, admin payment recording, public photos) requires:
- `approvalStatus = APPROVED` **and** `availability = ACTIVE`;
- RC, Insurance and PUC approved, with an evidence file, a genuine source and `validUntil` covering the return date (today for undated listings);
- for booking and payment, also a verified customer whose DL is valid through the return date.

**Invariants enforced in the service layer and covered by tests:**
- No path sets `APPROVED` without the photo and document checks.
- No administrator approves, or lifts a restriction on, their own car.
- No path sets `availability = ACTIVE` unless `approvalStatus = APPROVED` and the documents are compliant at that moment.
- **A car that is not `APPROVED` is never publicly bookable.** Since Phase 9 (D1), revocation also forces `INACTIVE`, so a revoked car cannot be `ACTIVE`. **Re-approval does not relist it:** the `REVIEW_REQUIRED` hold stays until an administrator who does not own the car explicitly reactivates it, which re-checks approval and compliance. Owners cannot lift the hold.
- Changing availability never changes approval.
- **Exception for the legacy admin body.** `{ status: 'ACTIVE' }` is an explicit activation request: it approves (when pending) and then calls the same admin reactivation, with the same checks. The `decision` API never activates.
- **Pending cars.** A car can still be `PENDING_APPROVAL` with `availability = ACTIVE` only if it was set up that way before Phase 9, or in test fixtures. It is never publicly bookable.

## 4. Migration and backfill (PostgreSQL migration, plus `db push` for SQLite)

1. Add the columns: nullable or defaulted, no drops.
2. Backfill from the current `status`. Conservative rule: approval is granted **only** where review evidence exists.

| Current `status` | Evidence available | `approvalStatus` | `availability` |
|---|---|---|---|
| `ACTIVE` | `VEHICLE_ACTIVE` audit by an admin ≠ host, **and** RC/Insurance/PUC approved **with** evidence files | `APPROVED` | `ACTIVE` |
| `ACTIVE` | Otherwise (e.g. the demo seed cars, or pre-Phase-4 admin-created cars) | `PENDING_APPROVAL` | `INACTIVE`, reason `REVIEW_REQUIRED`: an administrative restriction, so only an administrator can list the car after approval (D2, Phase 7) |
| `PENDING_APPROVAL` | – | `PENDING_APPROVAL` | `INACTIVE` |
| `INACTIVE` / `MAINTENANCE` | Earlier `VEHICLE_ACTIVE` audit by another admin | `APPROVED` | `INACTIVE` (reason `ADMIN_SUSPENDED` / `MAINTENANCE`) |
| `INACTIVE` / `MAINTENANCE` | No approval evidence | `PENDING_APPROVAL` | `INACTIVE` |

3. **Compatibility:** keep `status` as a derived column maintained by the service: `ACTIVE` when approved and available; `PENDING_APPROVAL` when pending or draft; `MAINTENANCE` or `INACTIVE` otherwise. Existing readers (web, mobile `GET /vehicles`, media visibility) keep working. Drop it only in a later, separately approved release.
4. **Verification:** extend `scripts/verify-migrations.mjs` with synthetic cars in every current state, asserting the table above, unchanged bookings, and no `APPROVED` without evidence.
5. **Rollback:** application rollback only (the old code reads `status`, which stays correct). The columns are not dropped.

## 5. API and UI changes

- **Admin review:** `POST /admin/vehicles/:id/review` takes `{ decision: APPROVE | REJECT | REVOKE, note }`. The old `{ status }` body stays accepted for one release and is mapped: `ACTIVE` → approve + activate, `PENDING_APPROVAL` → revoke, `INACTIVE`/`MAINTENANCE` → availability change.
- **Availability:** `POST /vehicles/:id/availability` `{ availability, reason }`, owner or admin, same management scope as availability blocks. `reason` is used only for an admin acting on another owner's car (`ADMIN_SUSPENDED` or `MAINTENANCE`). Administrative restrictions are enforced as described in §3.
- **Owner submit/resubmit:** `POST /vehicles/:id/submit`.
- **Web:** approval and availability badges; an owner pause/resume toggle; the admin decision form split into Approve, Reject and Revoke plus Availability.
- **Mobile:** no change required while `status` is maintained. `apps/mobile` will not be modified.

## 6. Test coverage (implemented)

- **Transitions:** every allowed transition, and every forbidden one (self-approval, approve without photos or evidence, activate while not approved, owner setting `APPROVED`).
- **Compliance:** document rejection revokes approval with an audit row. Expiry, missing evidence and demo/test sources make the car ineligible on every request (no automatic revocation, D3).
- **Public eligibility:** listing, detail, quote and booking each require `APPROVED` + `ACTIVE` + valid documents; the undated listing hides expired-document cars.
- **Bookings:** existing confirmed bookings survive availability changes.
- **Migration:** backfill cases, as in §4.
- **Playwright:** owner pause/resume, admin approve/reject/revoke, public visibility.

The Phase 5 guarantees are pinned by `src/vehicles/vehicle-eligibility.integration.spec.ts` (Phase 5), so the change can be verified against them.

## 7. Decisions needed before implementation (all taken; see §8)

- **D1.** Approve the two-field model and the transition table (§2–3), including whether **owners may pause/resume** availability themselves.
- **D2.** The backfill for `ACTIVE` cars without review evidence (the 6 local demo cars): delist them (`PENDING_APPROVAL`/`INACTIVE`) or grandfather them as `APPROVED`. The recommendation is to delist in any shared environment; this is linked to the document remediation decision in `docs/VEHICLE_COMPLIANCE_REMEDIATION.md` §7.
- **D3.** Should document **expiry** automatically revoke approval and deactivate the car (via a daily job, like `HoldExpiryService`), or only hide it from search?
- **D4.** On deactivation, what happens to future confirmed bookings: notify only, or require admin action?

## 8. Decisions taken and implementation notes (Phase 6)

- **D1.** Owners may pause and reactivate availability on their own cars and resubmit drafts or rejected listings. They can never approve or reject. This is enforced in `VehiclesService.setAvailability`/`submit` and the admin-only review endpoint.
- **D2.** The 6 demo cars are `PENDING_APPROVAL`/`INACTIVE` with reason `REVIEW_REQUIRED` and are not bookable. No evidence was fabricated. Each change has a `VEHICLE_STATUS_BACKFILLED` audit row holding the previous status, so it can be reversed.
- **D3.** Expired, missing, unevidenced, demo/test or expiry-less RC, Insurance or PUC makes a car ineligible for new bookings, checked server-side on every public path and at payment recording. There is no background job: expiry is evaluated on every request, so it needs no scheduler.
- **D4.** Deactivation and revocation only block new bookings. Existing bookings, payments and active trips are unchanged. Upcoming bookings are flagged once per booking and reason (`BOOKING_REVIEW_FLAGGED`) for admin action.
- **Design choice.** Approval does not switch availability on. After approval, the owner or an admin activates the car, and reactivation re-checks compliance. The legacy `{status: 'ACTIVE'}` admin body performs both steps explicitly.
- **Decided in Phase 7.** Owners cannot lift an administrative restriction (`ADMIN_SUSPENDED`, `MAINTENANCE`, `REVIEW_REQUIRED`); only an administrator who does not own the car can. An owner's pause never replaces an administrative reason. §3 reflects this (Phase 8 reconciliation).

## 9. Revocation and availability (resolved in Phase 9, decision D1)

**The Phase 8 discrepancy.** Revocation used to keep the car's availability, so a revoked active car became bookable again the moment it was re-approved.

**Decision D1** (2026-10-12) adopted option (b):
- Revocation, by `decision: REVOKE` or by a rejected vehicle document, sets `approvalStatus = PENDING_APPROVAL`, `availability = INACTIVE` and `availabilityReason = REVIEW_REQUIRED`.
- Re-approval leaves the hold in place. A separate, explicit reactivation by an administrator who does not own the car (`POST /vehicles/:id/availability` `{ availability: 'ACTIVE' }`, or the admin car folder's availability form) lists it again, after the approval and compliance checks pass.
- The audit row records the previous availability and reason.
- Existing bookings and payments are unchanged; upcoming bookings are flagged once per reason.

**Tests** (`vehicle-approval.integration.spec.ts`):
- Revocation applies the hold.
- Re-approval does not relist the car; the owner cannot lift the hold.
- Admin reactivation is refused while a document is expired, and succeeds once it is valid.
- A rejected document applies the same hold.

**Data.** No local car was ever approved, so no existing record needed to change.
