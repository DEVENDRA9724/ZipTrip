import { BadRequestException } from '@nestjs/common';

export function rentalPeriod(startInput: unknown, endInput: unknown, now = new Date()) {
  if (typeof startInput !== 'string' || typeof endInput !== 'string') throw new BadRequestException('Choose pickup and return dates');
  // API timestamps must include their timezone; browser-local timestamps are converted by the UI.
  const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  const start = new Date(startInput), end = new Date(endInput);
  if (!timestamp.test(startInput) || !timestamp.test(endInput) || !Number.isFinite(+start) || !Number.isFinite(+end) || start >= end) throw new BadRequestException('Choose a valid pickup and return time with a timezone');
  if (start < now || +end - +start > 90 * 86400000) throw new BadRequestException('Book in the future for up to 90 days');
  return { start, end };
}

export function overlappingReservations(start: Date, end: Date, now = new Date()) {
  return {
    startDate: { lt: end }, endDate: { gt: start },
    OR: [{ status: { in: ['CONFIRMED', 'ACTIVE'] } }, { status: 'PENDING', expiresAt: { gt: now } }],
  };
}
