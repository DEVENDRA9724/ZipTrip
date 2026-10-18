export declare const CAR_SHARING_AGREEMENT_VERSION = "safarcars-car-sharing-v2";
export type AgreementPolicySnapshot = {
    securityDeposit: number;
    includedKilometresPer24Hours: number;
    excessKmRate: number;
    lateGraceMinutes: number;
    lateReturnRatePerHour: number;
    cancellation: {
        moreThan48Hours: string;
        between24And48Hours: string;
        lessThan24Hours: string;
    };
};
export declare function agreementPolicySnapshot(policy: any): AgreementPolicySnapshot;
export declare function carSharingAgreementTerms(policy: AgreementPolicySnapshot): string[];
