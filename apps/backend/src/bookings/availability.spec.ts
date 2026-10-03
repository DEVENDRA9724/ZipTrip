import { rentalPeriod, overlappingReservations } from './availability';
import { VehiclesService } from '../vehicles/vehicles.service';

describe('Rental availability', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  const pickup = '2030-01-02T10:00:00+05:30';
  const drop = '2030-01-03T10:00:00+05:30';
  afterEach(() => jest.useRealTimers());
  it('converts explicit local offsets without changing the selected instant', () => {
    expect(rentalPeriod(pickup, drop, now).start.toISOString()).toBe('2030-01-02T04:30:00.000Z');
  });
  it.each([
    [undefined, drop], [pickup, undefined], ['invalid', drop],
    ['2030-01-02T10:00', drop], [drop, pickup], [pickup, pickup],
    ['2020-01-01T00:00:00Z', drop], [pickup, '2031-01-01T00:00:00Z'],
  ])('rejects invalid or incomplete rental periods (%s, %s)', (start, end) => {
    expect(() => rentalPeriod(start, end, now)).toThrow();
  });
  it('excludes overlapping confirmed/active trips and only unexpired pending holds', () => {
    const { start, end } = rentalPeriod(pickup, drop, now);
    expect(overlappingReservations(start, end, now)).toEqual({
      startDate: { lt: end }, endDate: { gt: start },
      OR: [{ status: { in: ['CONFIRMED', 'ACTIVE'] } }, { status: 'PENDING', expiresAt: { gt: now } }],
    });
  });
  it('filters search by reservations and vehicle documents valid through return', async () => {
    jest.useFakeTimers().setSystemTime(now);
    const findMany = jest.fn().mockResolvedValue([]);
    await new VehiclesService({ vehicle: { findMany } } as any).findAll({ startDate: pickup, endDate: drop, city: 'Ahmedabad' });
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.locationCity).toBe('Ahmedabad');
    expect(where.bookings.none).toEqual(overlappingReservations(new Date(pickup), new Date(drop), now));
    expect(where.AND).toHaveLength(3);
    expect(where.AND.map(item => item.documents.some.kind)).toEqual(['RC', 'INSURANCE', 'PUC']);
    expect(where.AND.every(item => +item.documents.some.validUntil.gte === +new Date(drop))).toBe(true);
  });
  it('rejects a one-sided date filter before accessing the database', () => {
    const findMany = jest.fn();
    expect(() => new VehiclesService({ vehicle: { findMany } } as any).findAll({ startDate: pickup })).toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
});
