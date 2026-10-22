"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentalPeriod = rentalPeriod;
exports.overlappingReservations = overlappingReservations;
const common_1 = require("@nestjs/common");
function rentalPeriod(startInput, endInput, now = new Date()) {
    if (typeof startInput !== 'string' || typeof endInput !== 'string')
        throw new common_1.BadRequestException('Choose pickup and return dates');
    const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
    const start = new Date(startInput), end = new Date(endInput);
    if (!timestamp.test(startInput) || !timestamp.test(endInput) || !Number.isFinite(+start) || !Number.isFinite(+end) || start >= end)
        throw new common_1.BadRequestException('Choose a valid pickup and return time with a timezone');
    if (start < now || +end - +start > 90 * 86400000)
        throw new common_1.BadRequestException('Book in the future for up to 90 days');
    return { start, end };
}
function overlappingReservations(start, end, now = new Date()) {
    return {
        startDate: { lt: end }, endDate: { gt: start },
        OR: [{ status: { in: ['CONFIRMED', 'ACTIVE'] } }, { status: 'PENDING', expiresAt: { gt: now } }],
    };
}
//# sourceMappingURL=availability.js.map