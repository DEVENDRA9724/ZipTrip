"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentalStateTransitions = void 0;
exports.canTransition = canTransition;
exports.assertBookingTransition = assertBookingTransition;
exports.assertVehicleTransition = assertVehicleTransition;
exports.assertPaymentTransition = assertPaymentTransition;
exports.assertTripTransition = assertTripTransition;
const bookingTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
};
const vehicleTransitions = {
    PENDING_APPROVAL: ['ACTIVE', 'INACTIVE'],
    ACTIVE: ['INACTIVE', 'MAINTENANCE'],
    INACTIVE: ['ACTIVE', 'PENDING_APPROVAL'],
    MAINTENANCE: ['ACTIVE', 'INACTIVE'],
};
const paymentTransitions = {
    INITIATED: ['SUCCESS', 'FAILED'],
    SUCCESS: ['REFUND_PENDING'],
    FAILED: ['INITIATED'],
    REFUND_PENDING: ['REFUNDED', 'FAILED'],
    REFUNDED: [],
};
const tripTransitions = {
    not_started: ['ongoing', 'cancelled'],
    ongoing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
function canTransition(transitions, from, to) {
    return transitions[from]?.includes(to) ?? false;
}
function assertBookingTransition(from, to) {
    if (!canTransition(bookingTransitions, from, to)) {
        throw new Error(`Invalid booking transition: ${from} -> ${to}`);
    }
}
function assertVehicleTransition(from, to) {
    if (!canTransition(vehicleTransitions, from, to)) {
        throw new Error(`Invalid vehicle transition: ${from} -> ${to}`);
    }
}
function assertPaymentTransition(from, to) {
    if (!canTransition(paymentTransitions, from, to)) {
        throw new Error(`Invalid payment transition: ${from} -> ${to}`);
    }
}
function assertTripTransition(from, to) {
    if (!canTransition(tripTransitions, from, to)) {
        throw new Error(`Invalid trip transition: ${from} -> ${to}`);
    }
}
exports.rentalStateTransitions = {
    booking: bookingTransitions,
    vehicle: vehicleTransitions,
    payment: paymentTransitions,
    trip: tripTransitions,
};
//# sourceMappingURL=rental-state.js.map