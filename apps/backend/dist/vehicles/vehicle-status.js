"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNVERIFIED_DOCUMENT_SOURCES = exports.REQUIRED_VEHICLE_DOCUMENTS = exports.REVOCATION_HOLD = exports.ADMINISTRATIVE_RESTRICTIONS = exports.AVAILABILITY_STATES = exports.APPROVAL_STATUSES = void 0;
exports.isAdministrativeRestriction = isAdministrativeRestriction;
exports.demoVerificationEnabled = demoVerificationEnabled;
exports.unverifiedDocumentSources = unverifiedDocumentSources;
exports.assertDemoVerificationAllowed = assertDemoVerificationAllowed;
exports.legacyVehicleStatus = legacyVehicleStatus;
exports.compliantDocumentWhere = compliantDocumentWhere;
exports.bookableVehicleWhere = bookableVehicleWhere;
exports.vehicleEligibility = vehicleEligibility;
exports.eligibilityMessage = eligibilityMessage;
exports.upcomingBookingWhere = upcomingBookingWhere;
exports.flagUpcomingBookings = flagUpcomingBookings;
exports.APPROVAL_STATUSES = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
];
exports.AVAILABILITY_STATES = ['ACTIVE', 'INACTIVE'];
exports.ADMINISTRATIVE_RESTRICTIONS = [
    'ADMIN_SUSPENDED',
    'MAINTENANCE',
    'REVIEW_REQUIRED',
];
exports.REVOCATION_HOLD = {
    approvalStatus: 'PENDING_APPROVAL',
    availability: 'INACTIVE',
    availabilityReason: 'REVIEW_REQUIRED',
    status: 'PENDING_APPROVAL',
};
function isAdministrativeRestriction(reason) {
    return exports.ADMINISTRATIVE_RESTRICTIONS.includes(reason ?? '');
}
exports.REQUIRED_VEHICLE_DOCUMENTS = ['RC', 'INSURANCE', 'PUC'];
exports.UNVERIFIED_DOCUMENT_SOURCES = ['DIGILOCKER_TEST', 'DEMO_SEED'];
function demoVerificationEnabled(env = process.env) {
    return env.DEMO_VERIFICATION === 'true' && env.NODE_ENV !== 'production';
}
function unverifiedDocumentSources() {
    return demoVerificationEnabled()
        ? ['DIGILOCKER_TEST']
        : exports.UNVERIFIED_DOCUMENT_SOURCES;
}
function assertDemoVerificationAllowed(env = process.env) {
    if (env.NODE_ENV === 'production' && env.DEMO_VERIFICATION === 'true')
        throw new Error('DEMO_VERIFICATION is for local demos only; remove it from the production environment.');
}
function legacyVehicleStatus(approval, availability, reason) {
    if (approval === 'APPROVED')
        return availability === 'ACTIVE'
            ? 'ACTIVE'
            : reason === 'MAINTENANCE'
                ? 'MAINTENANCE'
                : 'INACTIVE';
    return approval === 'REJECTED' ? 'INACTIVE' : 'PENDING_APPROVAL';
}
function compliantDocumentWhere(kind, until) {
    const genuine = {
        mediaId: { not: null },
        source: { notIn: exports.UNVERIFIED_DOCUMENT_SOURCES },
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
function bookableVehicleWhere(until) {
    return {
        approvalStatus: 'APPROVED',
        availability: 'ACTIVE',
        AND: exports.REQUIRED_VEHICLE_DOCUMENTS.map((kind) => ({
            documents: { some: compliantDocumentWhere(kind, until) },
        })),
    };
}
function vehicleEligibility(vehicle, until = new Date(), now = new Date()) {
    const reasons = [];
    if (vehicle.approvalStatus !== 'APPROVED')
        reasons.push('APPROVAL_' + vehicle.approvalStatus);
    if (vehicle.availability !== 'ACTIVE')
        reasons.push('UNAVAILABLE');
    for (const kind of exports.REQUIRED_VEHICLE_DOCUMENTS) {
        const docs = vehicle.documents.filter((d) => d.kind === kind);
        const demo = demoVerificationEnabled();
        const genuine = docs.filter((d) => d.status === 'APPROVED' &&
            ((d.mediaId && !exports.UNVERIFIED_DOCUMENT_SOURCES.includes(d.source || '')) ||
                (demo && d.source === 'DEMO_SEED')));
        if (genuine.some((d) => d.validUntil && d.validUntil >= until))
            continue;
        if (genuine.some((d) => d.validUntil && d.validUntil >= now))
            reasons.push(kind + '_EXPIRES_BEFORE_RETURN');
        else if (genuine.some((d) => d.validUntil))
            reasons.push(kind + '_EXPIRED');
        else if (genuine.length)
            reasons.push(kind + '_EXPIRY_MISSING');
        else if (docs.some((d) => d.status === 'APPROVED'))
            reasons.push(kind + '_UNVERIFIED');
        else if (docs.some((d) => d.status === 'PENDING'))
            reasons.push(kind + '_PENDING_REVIEW');
        else if (docs.some((d) => d.status === 'REJECTED'))
            reasons.push(kind + '_REJECTED');
        else
            reasons.push(kind + '_MISSING');
    }
    return { bookable: reasons.length === 0, reasons };
}
function eligibilityMessage(reasons) {
    const reason = reasons[0] || '';
    if (reason.startsWith('APPROVAL_') || reason === 'UNAVAILABLE')
        return 'This car is not available for booking right now.';
    if (reason.endsWith('_EXPIRES_BEFORE_RETURN'))
        return 'This car’s documents do not remain valid through your return date. Choose an earlier return date or another car.';
    return 'This car is not available for booking until its documents are verified.';
}
function upcomingBookingWhere(now = new Date()) {
    return {
        OR: [
            { status: 'CONFIRMED', startDate: { gt: now } },
            { status: 'PENDING', expiresAt: { gt: now } },
        ],
    };
}
async function flagUpcomingBookings(tx, vehicleId, reason, actorId, now = new Date()) {
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
        if (existing)
            continue;
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
//# sourceMappingURL=vehicle-status.js.map