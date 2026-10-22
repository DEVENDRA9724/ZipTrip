import type { Prisma, PrismaClient } from '@prisma/client';
// Single source of truth for vehicle approval, availability and public booking eligibility (Phase 6).
// Approval and availability are independent; a car is publicly bookable only when it is APPROVED, ACTIVE and holds
// approved, evidenced, unexpired RC, Insurance and PUC documents covering the requested period.
export const APPROVAL_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const;
export const AVAILABILITY_STATES = ['ACTIVE', 'INACTIVE'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type Availability = (typeof AVAILABILITY_STATES)[number];
// Availability reasons only an administrator (other than the car's owner) can clear. OWNER_PAUSED and no reason
// (a car never activated) are owner-controlled.
export const ADMINISTRATIVE_RESTRICTIONS = [
  'ADMIN_SUSPENDED',
  'MAINTENANCE',
  'REVIEW_REQUIRED',
] as const;
// State written when an approved car's approval is revoked (admin REVOKE or a rejected vehicle document): back to
// review, off the market and under an administrative review hold. Re-approval leaves the hold in place, so the car
// is listed again only when an administrator who does not own it explicitly reactivates it (which re-checks
// approval and compliance).
export const REVOCATION_HOLD = {
  approvalStatus: 'PENDING_APPROVAL',
  availability: 'INACTIVE',
  availabilityReason: 'REVIEW_REQUIRED',
  status: 'PENDING_APPROVAL',
} as const;
export function isAdministrativeRestriction(reason: string | null | undefined) {
  return (ADMINISTRATIVE_RESTRICTIONS as readonly string[]).includes(
    reason ?? '',
  );
}
export const REQUIRED_VEHICLE_DOCUMENTS = ['RC', 'INSURANCE', 'PUC'] as const;
// Document sources that are never genuine verification: provider test data and unverified demo/seed records.
export const UNVERIFIED_DOCUMENT_SOURCES = ['DIGILOCKER_TEST', 'DEMO_SEED'];

// Local demo mode (DEMO_VERIFICATION=true, never in production): the labelled DEMO_SEED records count as verification,
// with or without a file, so a local checkout can show approved cars, verified owners and working bookings.
// Provider test data (DIGILOCKER_TEST) still never counts, and the API refuses to start in production with this flag.
export function demoVerificationEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.DEMO_VERIFICATION === 'true' && env.NODE_ENV !== 'production';
}
export function unverifiedDocumentSources() {
  return demoVerificationEnabled()
    ? ['DIGILOCKER_TEST']
    : UNVERIFIED_DOCUMENT_SOURCES;
}
export function assertDemoVerificationAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV === 'production' && env.DEMO_VERIFICATION === 'true')
    throw new Error(
      'DEMO_VERIFICATION is for local demos only; remove it from the production environment.',
    );
}

// The legacy single-field status, kept in sync for existing readers (filters, mobile, older UI code).
export function legacyVehicleStatus(
  approval: string,
  availability: string,
  reason?: string | null,
): 'ACTIVE' | 'PENDING_APPROVAL' | 'INACTIVE' | 'MAINTENANCE' {
  if (approval === 'APPROVED')
    return availability === 'ACTIVE'
      ? 'ACTIVE'
      : reason === 'MAINTENANCE'
        ? 'MAINTENANCE'
        : 'INACTIVE';
  return approval === 'REJECTED' ? 'INACTIVE' : 'PENDING_APPROVAL';
}

// A document counts as compliance evidence only when approved, backed by an uploaded file, from a genuine source,
// and valid through `until`. A missing expiry date never counts as valid.
export function compliantDocumentWhere(kind: string, until: Date) {
  const genuine = {
    mediaId: { not: null },
    source: { notIn: UNVERIFIED_DOCUMENT_SOURCES },
  };
  return {
    kind,
    status: 'APPROVED',
    validUntil: { gte: until },
    ...(demoVerificationEnabled()
      ? { OR: [genuine, { source: 'DEMO_SEED' }] }
      : genuine),
  };
}

// Prisma filter used by every public listing, detail, quote and booking path.
export function bookableVehicleWhere(until: Date) {
  return {
    approvalStatus: 'APPROVED',
    availability: 'ACTIVE',
    AND: REQUIRED_VEHICLE_DOCUMENTS.map((kind) => ({
      documents: { some: compliantDocumentWhere(kind, until) },
    })),
  };
}

type Doc = {
  kind: string;
  status: string;
  mediaId: string | null;
  source: string | null;
  validUntil: Date | null;
};
export type EligibilityReason = string;

// Explains why a car is or is not bookable through `until` (for owners, admins and safe user messages).
export function vehicleEligibility(
  vehicle: { approvalStatus: string; availability: string; documents: Doc[] },
  until: Date = new Date(),
  now: Date = new Date(),
) {
  const reasons: EligibilityReason[] = [];
  if (vehicle.approvalStatus !== 'APPROVED')
    reasons.push('APPROVAL_' + vehicle.approvalStatus);
  if (vehicle.availability !== 'ACTIVE') reasons.push('UNAVAILABLE');
  for (const kind of REQUIRED_VEHICLE_DOCUMENTS) {
    const docs = vehicle.documents.filter((d) => d.kind === kind);
    const demo = demoVerificationEnabled();
    const genuine = docs.filter(
      (d) =>
        d.status === 'APPROVED' &&
        ((d.mediaId && !UNVERIFIED_DOCUMENT_SOURCES.includes(d.source || '')) ||
          (demo && d.source === 'DEMO_SEED')),
    );
    if (genuine.some((d) => d.validUntil && d.validUntil >= until)) continue;
    if (genuine.some((d) => d.validUntil && d.validUntil >= now))
      reasons.push(kind + '_EXPIRES_BEFORE_RETURN');
    else if (genuine.some((d) => d.validUntil)) reasons.push(kind + '_EXPIRED');
    else if (genuine.length) reasons.push(kind + '_EXPIRY_MISSING');
    else if (docs.some((d) => d.status === 'APPROVED'))
      reasons.push(kind + '_UNVERIFIED');
    else if (docs.some((d) => d.status === 'PENDING'))
      reasons.push(kind + '_PENDING_REVIEW');
    else if (docs.some((d) => d.status === 'REJECTED'))
      reasons.push(kind + '_REJECTED');
    else reasons.push(kind + '_MISSING');
  }
  return { bookable: reasons.length === 0, reasons };
}

// Customer-safe text for the first blocking reason (no internal ids or document details).
export function eligibilityMessage(reasons: EligibilityReason[]) {
  const reason = reasons[0] || '';
  if (reason.startsWith('APPROVAL_') || reason === 'UNAVAILABLE')
    return 'This car is not available for booking right now.';
  if (reason.endsWith('_EXPIRES_BEFORE_RETURN'))
    return 'This car’s documents do not remain valid through your return date. Choose an earlier return date or another car.';
  return 'This car is not available for booking until its documents are verified.';
}

// Bookings that can still start: live unpaid holds and confirmed trips not yet started. Active trips, completed,
// cancelled and expired holds are never touched or flagged.
export function upcomingBookingWhere(now: Date = new Date()) {
  return {
    OR: [
      { status: 'CONFIRMED' as const, startDate: { gt: now } },
      { status: 'PENDING' as const, expiresAt: { gt: now } },
    ],
  };
}

// Records an admin-review flag on each upcoming booking of a car. Bookings are never cancelled, refunded or changed.
// Idempotent: one flag per booking and reason.
export async function flagUpcomingBookings(
  tx: Prisma.TransactionClient | PrismaClient,
  vehicleId: string,
  reason: string,
  actorId: string,
  now: Date = new Date(),
) {
  const bookings = await tx.booking.findMany({
    where: { vehicleId, ...upcomingBookingWhere(now) },
    select: { id: true, status: true, startDate: true },
  });
  let flagged = 0;
  for (const booking of bookings) {
    const existing = await tx.auditLog.findFirst({
      where: {
        action: 'BOOKING_REVIEW_FLAGGED',
        targetId: booking.id,
        detail: { contains: `"reason":"${reason}"` },
      },
    });
    if (existing) continue;
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'BOOKING_REVIEW_FLAGGED',
        targetId: booking.id,
        detail: JSON.stringify({
          reason,
          vehicleId,
          bookingStatus: booking.status,
          startDate: booking.startDate,
        }),
      },
    });
    flagged++;
  }
  return flagged;
}
