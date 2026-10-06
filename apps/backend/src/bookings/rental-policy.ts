import { BadRequestException } from '@nestjs/common';

/**
 * The commercial rules used by quotes and agreements. Values can be changed
 * through environment variables during rollout without changing source code.
 */
export const rentalPolicy = {
  deposit: Number(process.env.DEFAULT_SECURITY_DEPOSIT || 2000),
  kilometresPer24Hours: Number(process.env.INCLUDED_KM_PER_24_HOURS || 300),
  excessKmRate: Number(process.env.EXCESS_KM_RATE || 10),
  lateGraceMinutes: Number(process.env.LATE_RETURN_GRACE_MINUTES || 30),
  lateRatePerHour: Number(process.env.LATE_RETURN_RATE_PER_HOUR || 500),
  cancellation: {
    moreThan48Hours: 'Full rental refund, excluding non-refundable gateway charges.',
    between24And48Hours: '50% of the rental amount is refundable, excluding the security deposit and gateway charges.',
    lessThan24Hours: 'Rental amount is non-refundable; the security deposit is returned if no settlement is due.',
  },
};

for (const [key, value] of Object.entries(rentalPolicy)) {
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid rental policy value: ${key}`);
}

export function lateReturnCharge(returnedAt: Date, scheduledAt: Date) {
  const lateMinutes = Math.max(0, Math.ceil((+returnedAt - +scheduledAt) / 60000) - rentalPolicy.lateGraceMinutes);
  const lateHours = Math.ceil(lateMinutes / 60);
  return { lateMinutes, lateHours, amount: lateHours * rentalPolicy.lateRatePerHour };
}

export function cancellationRefundPercent(startDate: Date, now = new Date()) {
  const hours = (+startDate - +now) / 3600000;
  if (hours > 48) return 100;
  if (hours > 24) return 50;
  return 0;
}

export function assertPolicyConfiguration() {
  if (rentalPolicy.deposit < 0 || rentalPolicy.kilometresPer24Hours <= 0 || rentalPolicy.excessKmRate < 0 || rentalPolicy.lateRatePerHour < 0) {
    throw new BadRequestException('Rental policy configuration is invalid');
  }
}
