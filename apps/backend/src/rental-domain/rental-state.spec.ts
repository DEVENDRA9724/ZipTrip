import {
  assertBookingTransition,
  assertPaymentTransition,
  assertTripTransition,
  assertVehicleTransition,
  canTransition,
  rentalStateTransitions,
} from './rental-state';

describe('rental state transitions', () => {
  it('allows the normal booking lifecycle', () => {
    expect(canTransition(rentalStateTransitions.booking, 'PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition(rentalStateTransitions.booking, 'CONFIRMED', 'ACTIVE')).toBe(true);
    expect(canTransition(rentalStateTransitions.booking, 'ACTIVE', 'COMPLETED')).toBe(true);
  });

  it('rejects skipping pickup or reopening a completed booking', () => {
    expect(() => assertBookingTransition('PENDING', 'COMPLETED')).toThrow('Invalid booking transition');
    expect(() => assertBookingTransition('COMPLETED', 'ACTIVE')).toThrow('Invalid booking transition');
  });

  it('covers payment, trip, and vehicle operational transitions', () => {
    expect(() => assertPaymentTransition('SUCCESS', 'REFUND_PENDING')).not.toThrow();
    expect(() => assertTripTransition('not_started', 'ongoing')).not.toThrow();
    expect(() => assertVehicleTransition('ACTIVE', 'MAINTENANCE')).not.toThrow();
    expect(() => assertVehicleTransition('PENDING_APPROVAL', 'MAINTENANCE')).toThrow('Invalid vehicle transition');
  });
});
