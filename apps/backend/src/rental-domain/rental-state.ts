/**
 * State transitions for the rental domain.
 *
 * Keeping these transitions in one place prevents controllers and services from
 * accidentally skipping a step in the rental lifecycle. The database update
 * still uses a compare-and-set predicate, so this validation is paired with
 * transactional concurrency protection in the calling service.
 */

export type BookingState = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type VehicleState = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type PaymentState = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
export type TripState = 'not_started' | 'ongoing' | 'completed' | 'cancelled';

const bookingTransitions: Record<BookingState, readonly BookingState[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const vehicleTransitions: Record<VehicleState, readonly VehicleState[]> = {
  PENDING_APPROVAL: ['ACTIVE', 'INACTIVE'],
  ACTIVE: ['INACTIVE', 'MAINTENANCE'],
  INACTIVE: ['ACTIVE', 'PENDING_APPROVAL'],
  MAINTENANCE: ['ACTIVE', 'INACTIVE'],
};

const paymentTransitions: Record<PaymentState, readonly PaymentState[]> = {
  INITIATED: ['SUCCESS', 'FAILED'],
  SUCCESS: ['REFUND_PENDING'],
  FAILED: ['INITIATED'],
  REFUND_PENDING: ['REFUNDED', 'FAILED'],
  REFUNDED: [],
};

const tripTransitions: Record<TripState, readonly TripState[]> = {
  not_started: ['ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition<T extends string>(
  transitions: Record<T, readonly T[]>,
  from: T,
  to: T,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertBookingTransition(from: string, to: BookingState): void {
  if (!canTransition(bookingTransitions, from as BookingState, to)) {
    throw new Error(`Invalid booking transition: ${from} -> ${to}`);
  }
}

export function assertVehicleTransition(from: string, to: VehicleState): void {
  if (!canTransition(vehicleTransitions, from as VehicleState, to)) {
    throw new Error(`Invalid vehicle transition: ${from} -> ${to}`);
  }
}

export function assertPaymentTransition(from: string, to: PaymentState): void {
  if (!canTransition(paymentTransitions, from as PaymentState, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function assertTripTransition(from: string, to: TripState): void {
  if (!canTransition(tripTransitions, from as TripState, to)) {
    throw new Error(`Invalid trip transition: ${from} -> ${to}`);
  }
}

export const rentalStateTransitions = {
  booking: bookingTransitions,
  vehicle: vehicleTransitions,
  payment: paymentTransitions,
  trip: tripTransitions,
} as const;
