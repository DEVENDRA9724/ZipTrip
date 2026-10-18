export declare const rentalPolicy: {
    deposit: number;
    kilometresPer24Hours: number;
    excessKmRate: number;
    lateGraceMinutes: number;
    lateRatePerHour: number;
    platformCommissionRate: number;
    cancellation: {
        moreThan48Hours: string;
        between24And48Hours: string;
        lessThan24Hours: string;
    };
};
export declare function lateReturnCharge(returnedAt: Date, scheduledAt: Date): {
    lateMinutes: number;
    lateHours: number;
    amount: number;
};
export declare function cancellationRefundPercent(startDate: Date, now?: Date): 100 | 50 | 0;
export declare function assertPolicyConfiguration(): void;
