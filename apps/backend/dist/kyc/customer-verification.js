"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeCustomerVerification = recomputeCustomerVerification;
const vehicle_status_1 = require("../vehicles/vehicle-status");
async function recomputeCustomerVerification(tx, userId, now = new Date()) {
    const approved = await tx.document.findMany({
        where: {
            userId,
            vehicleId: null,
            status: 'APPROVED',
            source: { notIn: (0, vehicle_status_1.unverifiedDocumentSources)() },
        },
    });
    const dl = approved
        .filter((d) => d.kind === 'DL' && d.validUntil && d.validUntil > now)
        .sort((a, b) => Number(b.validUntil) - Number(a.validUntil))[0];
    const isVerified = Boolean(dl && approved.some((d) => d.kind === 'AADHAAR'));
    const dlValidUntil = dl?.validUntil || null;
    await tx.user.update({
        where: { id: userId },
        data: { isVerified, dlValidUntil },
    });
    return { isVerified, dlValidUntil };
}
//# sourceMappingURL=customer-verification.js.map