"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryObjectStorage = exports.S3ObjectStorage = void 0;
exports.s3Settings = s3Settings;
exports.objectStorage = objectStorage;
exports.memoryObjectStorage = memoryObjectStorage;
exports.assertProductionStorage = assertProductionStorage;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
function s3Settings(env = process.env) {
    return {
        bucket: env.S3_BUCKET || '',
        region: env.S3_REGION || env.AWS_REGION || 'ap-south-1',
        endpoint: env.S3_ENDPOINT || undefined,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
        prefix: (env.S3_PREFIX ?? 'media/').replace(/^\/+/, '').replace(/([^/])$/, '$1/'),
        serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION || undefined,
        credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.S3_ACCESS_KEY_ID,
                secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
            : undefined,
    };
}
function unavailable(action, error) {
    new common_1.Logger('ObjectStorage').error(`S3 ${action} failed: ${error?.name || 'Error'}`);
    throw new common_1.ServiceUnavailableException('File storage is temporarily unavailable');
}
class S3ObjectStorage {
    client;
    settings;
    constructor(env = process.env, client = new client_s3_1.S3Client({
        region: s3Settings(env).region,
        endpoint: s3Settings(env).endpoint,
        forcePathStyle: s3Settings(env).forcePathStyle,
        credentials: s3Settings(env).credentials,
    })) {
        this.client = client;
        this.settings = s3Settings(env);
    }
    objectKey(key) {
        return key.startsWith(this.settings.prefix) ? key : this.settings.prefix + key;
    }
    async put(key, body, contentType) {
        const input = {
            Bucket: this.settings.bucket,
            Key: this.objectKey(key),
            Body: body,
            ContentType: contentType,
            ...(this.settings.serverSideEncryption
                ? {
                    ServerSideEncryption: this.settings
                        .serverSideEncryption,
                }
                : {}),
        };
        await this.client
            .send(new client_s3_1.PutObjectCommand(input))
            .catch((error) => unavailable('upload', error));
    }
    async get(key) {
        try {
            const result = await this.client.send(new client_s3_1.GetObjectCommand({
                Bucket: this.settings.bucket,
                Key: this.objectKey(key),
            }));
            const bytes = await result.Body?.transformToByteArray();
            return bytes ? Buffer.from(bytes) : null;
        }
        catch (error) {
            const name = error?.name ||
                error?.Code;
            if (name === 'NoSuchKey' || name === 'NotFound')
                return null;
            return unavailable('read', error);
        }
    }
    async remove(key) {
        await this.client
            .send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.settings.bucket,
            Key: this.objectKey(key),
        }))
            .catch((error) => unavailable('delete', error));
    }
}
exports.S3ObjectStorage = S3ObjectStorage;
class MemoryObjectStorage {
    objects = new Map();
    put(key, body, contentType) {
        this.objects.set(key, { body: Buffer.from(body), contentType });
        return Promise.resolve();
    }
    get(key) {
        return Promise.resolve(this.objects.get(key)?.body ?? null);
    }
    remove(key) {
        this.objects.delete(key);
        return Promise.resolve();
    }
}
exports.MemoryObjectStorage = MemoryObjectStorage;
class UnconfiguredStorage {
    fail() {
        return Promise.reject(new common_1.ServiceUnavailableException('File storage is not configured'));
    }
    put() {
        return this.fail();
    }
    get() {
        return this.fail();
    }
    remove() {
        return this.fail();
    }
}
let shared;
let memory;
function objectStorage(env = process.env) {
    if (env.MEDIA_STORAGE === 'memory') {
        if (env.NODE_ENV === 'production')
            throw new Error('MEDIA_STORAGE=memory is for tests only');
        return (memory ??= new MemoryObjectStorage());
    }
    return (shared ??= env.S3_BUCKET
        ? new S3ObjectStorage(env)
        : new UnconfiguredStorage());
}
function memoryObjectStorage() {
    return (memory ??= new MemoryObjectStorage());
}
function assertProductionStorage(env = process.env) {
    if (env.NODE_ENV === 'production' &&
        (!env.S3_BUCKET || env.MEDIA_STORAGE === 'memory'))
        throw new Error('Set S3_BUCKET (and S3 credentials or an instance role): uploads are stored in S3 only.');
}
//# sourceMappingURL=object-storage.js.map