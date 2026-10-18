"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentalQuote = rentalQuote;
const common_1 = require("@nestjs/common");
const rental_policy_1 = require("./rental-policy");
function rentalQuote(dailyRate, start, end) {
    const rate = Number(dailyRate);
    const dailyPaise = Math.round(rate * 100);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(dailyPaise))
        throw new common_1.BadRequestException('Vehicle pricing is unavailable');
    const rentalDays = Math.ceil((+end - +start) / 86400000);
    if (rentalDays < 1 || rentalDays > 90)
        throw new common_1.BadRequestException('Invalid rental duration');
    const includedKilometres = Math.floor((+end - +start) / 86400000 * rental_policy_1.rentalPolicy.kilometresPer24Hours);
    const rentalAmount = dailyPaise * rentalDays / 100;
    const securityDeposit = rental_policy_1.rentalPolicy.deposit;
    return { currency: 'INR', dailyRate: dailyPaise / 100, rentalDays, includedKilometres, rentalAmount, securityDeposit, totalAmount: rentalAmount + securityDeposit,
        excessKmRate: rental_policy_1.rentalPolicy.excessKmRate,
        pricingBasis: 'Each started 24-hour period is billed as one rental day. Distance allowance is prorated by rental hours.' };
}
//# sourceMappingURL=pricing.js.map