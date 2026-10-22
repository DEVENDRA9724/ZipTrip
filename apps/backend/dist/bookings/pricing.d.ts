export declare function rentalQuote(dailyRate: unknown, start: Date, end: Date): {
    currency: string;
    dailyRate: number;
    rentalDays: number;
    includedKilometres: number;
    rentalAmount: number;
    securityDeposit: number;
    totalAmount: number;
    excessKmRate: number;
    pricingBasis: string;
};
