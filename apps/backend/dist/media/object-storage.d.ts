import { S3Client } from '@aws-sdk/client-s3';
export interface ObjectStorage {
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<Buffer | null>;
    remove(key: string): Promise<void>;
}
export type StorageEnv = Record<string, string | undefined>;
export declare function s3Settings(env?: StorageEnv): {
    bucket: string;
    region: string;
    endpoint: string | undefined;
    forcePathStyle: boolean;
    prefix: string;
    serverSideEncryption: string | undefined;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    } | undefined;
};
export declare class S3ObjectStorage implements ObjectStorage {
    private readonly client;
    private readonly settings;
    constructor(env?: StorageEnv, client?: Pick<S3Client, 'send'>);
    private objectKey;
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<Buffer<ArrayBuffer> | null>;
    remove(key: string): Promise<void>;
}
export declare class MemoryObjectStorage implements ObjectStorage {
    readonly objects: Map<string, {
        body: Buffer;
        contentType: string;
    }>;
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<Buffer<ArrayBufferLike> | null>;
    remove(key: string): Promise<void>;
}
export declare function objectStorage(env?: StorageEnv): ObjectStorage;
export declare function memoryObjectStorage(): MemoryObjectStorage;
export declare function assertProductionStorage(env?: StorageEnv): void;
