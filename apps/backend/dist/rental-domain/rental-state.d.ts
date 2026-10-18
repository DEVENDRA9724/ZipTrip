export type BookingState = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type VehicleState = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type PaymentState = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
export type TripState = 'not_started' | 'ongoing' | 'completed' | 'cancelled';
export declare function canTransition<T extends string>(transitions: Record<T, readonly T[]>, from: T, to: T): boolean;
export declare function assertBookingTransition(from: string, to: BookingState): void;
export declare function assertVehicleTransition(from: string, to: VehicleState): void;
export declare function assertPaymentTransition(from: string, to: PaymentState): void;
export declare function assertTripTransition(from: string, to: TripState): void;
export declare const rentalStateTransitions: {
    readonly booking: Record<BookingState, readonly BookingState[]>;
    readonly vehicle: Record<VehicleState, readonly VehicleState[]>;
    readonly payment: Record<PaymentState, readonly PaymentState[]>;
    readonly trip: Record<TripState, readonly TripState[]>;
};
