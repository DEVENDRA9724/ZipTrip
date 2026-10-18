export declare function rentalPeriod(startInput: unknown, endInput: unknown, now?: Date): {
    start: Date;
    end: Date;
};
export declare function overlappingReservations(start: Date, end: Date, now?: Date): {
    startDate: {
        lt: Date;
    };
    endDate: {
        gt: Date;
    };
    OR: ({
        status: {
            in: string[];
        };
        expiresAt?: undefined;
    } | {
        status: string;
        expiresAt: {
            gt: Date;
        };
    })[];
};
