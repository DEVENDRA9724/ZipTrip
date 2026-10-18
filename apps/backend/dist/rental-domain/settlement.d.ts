export type SettlementCharges = {
    depositHeld: number;
    automaticCharges?: number;
    damageCharges?: number;
    fuelCharges?: number;
    tollCharges?: number;
    fineCharges?: number;
    cleaningCharges?: number;
    otherCharges?: number;
};
export declare function calculateSettlement(charges: SettlementCharges): {
    depositHeld: number;
    automaticCharges: number;
    damageCharges: number;
    fuelCharges: number;
    tollCharges: number;
    fineCharges: number;
    cleaningCharges: number;
    otherCharges: number;
    totalDeduction: number;
    refundAmount: number;
    additionalAmountDue: number;
};
