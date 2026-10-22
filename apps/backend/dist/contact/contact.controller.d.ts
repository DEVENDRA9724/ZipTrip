export declare function businessContact(env?: NodeJS.ProcessEnv): {
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
};
export declare class ContactController {
    contact(): {
        name: string;
        phone: string | null;
        whatsapp: string | null;
        email: string | null;
        address: string | null;
    };
}
