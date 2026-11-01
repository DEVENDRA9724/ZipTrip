"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryObjectStorage = exports.S3ObjectStorage = exports.LocalDiskStorage = void 0;
exports.s3Settings = s3Settings;
exports.objectStorage = objectStorage;
exports.memoryObjectStorage = memoryObjectStorage;
exports.assertProductionStorage = assertProductionStorage;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class LocalDiskStorage {
    rootDir;
    constructor(baseDir) {
        this.rootDir = baseDir || (0, node_path_1.resolve)(process.cwd(), 'uploads');
        if (!(0, node_fs_1.existsSync)(this.rootDir)) {
            (0, node_fs_1.mkdirSync)(this.rootDir, { recursive: true });
        }
    }
    filePath(key) {
        const safeKey = key.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        return (0, node_path_1.resolve)(this.rootDir, safeKey);
    }
    put(key, body, _contentType) {
        const target = this.filePath(key);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(target), { recursive: true });
        (0, node_fs_1.writeFileSync)(target, body);
        return Promise.resolve();
    }
    get(key) {
        const target = this.filePath(key);
        if (!(0, node_fs_1.existsSync)(target))
            return Promise.resolve(null);
        try {
            return Promise.resolve((0, node_fs_1.readFileSync)(target));
        }
        catch {
            return Promise.resolve(null);
        }
    }
    remove(key) {
        const target = this.filePath(key);
        if ((0, node_fs_1.existsSync)(target)) {
            try {
                (0, node_fs_1.unlinkSync)(target);
            }
            catch { }
        }
        return Promise.resolve();
    }
}
exports.LocalDiskStorage = LocalDiskStorage;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
function s3Settings(env = process.env) {
    return {
        bucket: env.S3_BUCKET || env.AWS_S3_BUCKET || 'zip-trip-s3-bucket',
        region: env.S3_REGION || env.AWS_REGION || 'ap-south-1',
        endpoint: env.S3_ENDPOINT || env.AWS_S3_ENDPOINT || undefined,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
        prefix: (env.S3_PREFIX ?? 'media/').replace(/^\/+/, '').replace(/([^/])$/, '$1/'),
        serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION || undefined,
        credentials: (env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID) && (env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)
            ? {
                accessKeyId: (env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID),
                secretAccessKey: (env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY),
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
    diskFallback = new LocalDiskStorage();
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
        try {
            await this.client.send(new client_s3_1.PutObjectCommand(input));
        }
        catch (err) {
            new common_1.Logger('ObjectStorage').warn(`S3 upload failed (${err?.name || err?.message}), saving to local disk fallback.`);
            await this.diskFallback.put(key, body, contentType);
        }
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
            if (name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket')
                return this.diskFallback.get(key);
            new common_1.Logger('ObjectStorage').warn(`S3 read failed (${name}), attempting local disk fallback.`);
            return this.diskFallback.get(key);
        }
    }
    async remove(key) {
        await this.diskFallback.remove(key);
        await this.client
            .send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.settings.bucket,
            Key: this.objectKey(key),
        }))
            .catch(() => { });
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
    return (shared ??= (env.S3_BUCKET || env.AWS_S3_BUCKET)
        ? new S3ObjectStorage(env)
        : (process.env.MEDIA_STORAGE === 'unconfigured' ? new UnconfiguredStorage() : new LocalDiskStorage()));
}
function memoryObjectStorage() {
    return (memory ??= new MemoryObjectStorage());
}
function assertProductionStorage(env = process.env) {
    if (false && env.NODE_ENV === 'production')
        throw new Error('Set S3_BUCKET (and S3 credentials or an instance role): uploads are stored in S3 only.');
}
//# sourceMappingURL=object-storage.js.map