export declare function text(value: unknown, field: string, max?: number): string;
export declare function number(value: unknown, field: string, min: number, max: number, integer?: boolean): number;
export declare function choice(value: unknown, field: string, values: readonly string[]): string;
export declare function admin(user: {
    role: string;
}): void;
export declare const FLEET_ROLES: readonly ["HOST", "DEALER", "ADMIN"];
export declare function fleetManager(user: {
    role: string;
}): void;
export declare const PHOTO_KINDS: readonly ["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "BOOT", "BONNET", "ODOMETER"];
export declare const INSPECTION_KINDS: readonly ["ODOMETER", "SELFIE_PICKUP", "SELFIE_RETURN", "SELFIE_KYC", "DAMAGE", "INSPECTION_PICKUP", "INSPECTION_RETURN"];
export declare const DOCUMENT_KINDS: readonly ["AADHAAR", "DL", "RC", "INSURANCE", "PUC"];
