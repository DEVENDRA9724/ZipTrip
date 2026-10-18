"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const sharp_1 = __importDefault(require("sharp"));
const client_s3_1 = require("@aws-sdk/client-s3");
const PRIVATE_DOCUMENT_KINDS = new Set(['AADHAAR', ...validation_1.DOCUMENT_KINDS]);
let MediaService = class MediaService {
    prisma;
    s3;
    constructor(prisma) {
        this.prisma = prisma;
    }
    directory() { return (0, node_path_1.resolve)(process.env.UPLOAD_DIR || './uploads'); }
    bucket() { return process.env.S3_BUCKET?.trim() || ''; }
    prefix() { return (process.env.S3_PREFIX || 'safar-media').replace(/^\/+|\/+$/g, ''); }
    objectKey(fileName) { return `${this.prefix()}/${fileName}`; }
    objectStorageEnabled() { return Boolean(this.bucket() && process.env.AWS_REGION); }
    client() {
        if (!this.objectStorageEnabled())
            return undefined;
        if (!this.s3)
            this.s3 = new client_s3_1.S3Client({
                region: process.env.AWS_REGION,
                endpoint: process.env.S3_ENDPOINT || undefined,
                forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
            });
        return this.s3;
    }
    async writeStorage(fileName, buffer, mimeType) {
        const client = this.client();
        if (client) {
            const s3Key = this.objectKey(fileName);
            try {
                await client.send(new client_s3_1.PutObjectCommand({ Bucket: this.bucket(), Key: s3Key, Body: buffer, ContentType: mimeType, ServerSideEncryption: 'AES256' }));
                return s3Key;
            }
            catch {
            }
        }
        await (0, promises_1.mkdir)(this.directory(), { recursive: true });
        await (0, promises_1.writeFile)((0, node_path_1.resolve)(this.directory(), fileName), buffer, { flag: 'wx' });
        return fileName;
    }
    async removeStorage(storageKey) {
        const client = this.client();
        if (client && storageKey.startsWith(this.prefix() + '/')) {
            await client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket(), Key: storageKey })).catch(() => undefined);
            return;
        }
        await (0, promises_1.unlink)((0, node_path_1.resolve)(this.directory(), storageKey)).catch(() => undefined);
    }
    async readStorage(storageKey) {
        const client = this.client();
        if (client && storageKey.startsWith(this.prefix() + '/')) {
            const result = await client.send(new client_s3_1.GetObjectCommand({ Bucket: this.bucket(), Key: storageKey }));
            if (!result.Body)
                throw new common_1.ServiceUnavailableException('Stored media is unavailable');
            return Buffer.from(await result.Body.transformToByteArray());
        }
        return (0, promises_1.readFile)((0, node_path_1.resolve)(this.directory(), storageKey));
    }
    key() {
        const key = process.env.DOCUMENT_ENCRYPTION_KEY || '';
        if (!/^[a-f0-9]{64}$/i.test(key))
            throw new common_1.ServiceUnavailableException('Private document storage is not configured');
        return Buffer.from(key, 'hex');
    }
    async upload(userId, kindInput, file) {
        const kind = (0, validation_1.choice)(kindInput, 'Photo/document type', [...validation_1.PHOTO_KINDS, ...validation_1.INSPECTION_KINDS, ...validation_1.DOCUMENT_KINDS]);
        if (!file?.buffer || file.size > 8 * 1024 * 1024)
            throw new common_1.BadRequestException('Upload a JPEG, PNG or WebP image up to 8 MB');
        let buffer;
        try {
            const input = (0, sharp_1.default)(file.buffer, { limitInputPixels: 25000000, failOn: 'error' });
            const metadata = await input.metadata();
            if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1)
                throw new Error();
            buffer = await input.rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
        }
        catch {
            throw new common_1.BadRequestException('Invalid image. Use a single JPEG, PNG or WebP image under 25 megapixels.');
        }
        const isPrivate = validation_1.DOCUMENT_KINDS.includes(kind);
        if (isPrivate) {
            const iv = (0, node_crypto_1.randomBytes)(12);
            const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.key(), iv);
            const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
            buffer = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
        }
        const storageKey = await this.writeStorage((0, node_crypto_1.randomUUID)() + (isPrivate ? '.enc' : '.jpg'), buffer, 'image/jpeg');
        try {
            const result = await this.prisma.media.create({ data: { ownerId: userId, kind, storageKey, mimeType: 'image/jpeg', size: buffer.length, sha256: (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex') } });
            return { id: result.id, kind, url: '/api/media/' + result.id };
        }
        catch (e) {
            await this.removeStorage(storageKey);
            throw e;
        }
    }
    async storePrivateDocument(ownerId, kindInput, buffer, mimeType) {
        const kind = (0, validation_1.choice)(kindInput, 'Document type', [...PRIVATE_DOCUMENT_KINDS]);
        if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 12 * 1024 * 1024)
            throw new common_1.BadRequestException('Provider document is empty or exceeds the 12 MB limit');
        if (typeof mimeType !== 'string' || !/^(application\/(pdf|xml|octet-stream)|text\/xml|image\/(jpeg|png|webp))$/i.test(mimeType))
            throw new common_1.BadRequestException('Provider returned an unsupported document format');
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.key(), iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const stored = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
        const storageKey = await this.writeStorage((0, node_crypto_1.randomUUID)() + '.enc', stored, mimeType.toLowerCase());
        try {
            const result = await this.prisma.media.create({ data: { ownerId, kind, storageKey, mimeType: mimeType.toLowerCase(), size: stored.length, sha256: (0, node_crypto_1.createHash)('sha256').update(stored).digest('hex') } });
            return result.id;
        }
        catch (e) {
            await this.removeStorage(storageKey);
            throw e;
        }
    }
    async read(id, user) {
        const media = await this.prisma.media.findUnique({ where: { id }, include: { vehicle: { select: { status: true } } } });
        if (!media)
            throw new common_1.NotFoundException('Image not found');
        const isPrivate = PRIVATE_DOCUMENT_KINDS.has(media.kind);
        const publicPhoto = !isPrivate && (media.vehicle?.status === 'ACTIVE' || (!media.vehicleId && Boolean(user)));
        if (!publicPhoto && (!user || (user.id !== media.ownerId && !['ADMIN', 'HOST', 'DEALER'].includes(user.role)))) {
            throw new common_1.ForbiddenException('Image access denied');
        }
        let buffer = await this.readStorage(media.storageKey);
        if (isPrivate) {
            const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', this.key(), buffer.subarray(0, 12));
            decipher.setAuthTag(buffer.subarray(12, 28));
            buffer = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
        }
        return { buffer, mimeType: media.mimeType };
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MediaService);
//# sourceMappingURL=media.service.js.map