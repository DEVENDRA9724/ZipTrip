import { BadRequestException } from '@nestjs/common';

export function rentalQuote(dailyRate: unknown, start: Date, end: Date) {
  const rate = Number(dailyRate);
  const dailyPaise = Math.round(rate * 100);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(dailyPaise)) throw new BadRequestException('Vehicle pricing is unavailable');
  const rentalDays = Math.ceil((+end - +start) / 86400000);
  if (rentalDays < 1 || rentalDays > 90) throw new BadRequestException('Invalid rental duration');
  const includedKilometres = Math.floor((+end - +start) / 86400000 * 300);
  const rentalAmount = dailyPaise * rentalDays / 100;
  const securityDeposit = 2000;
  return { currency: 'INR', dailyRate: dailyPaise / 100, rentalDays, includedKilometres, rentalAmount, securityDeposit, totalAmount: rentalAmount + securityDeposit,
    pricingBasis: 'Each started 24-hour period is billed as one rental day.' };
}
