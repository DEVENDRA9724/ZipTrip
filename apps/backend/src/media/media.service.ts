import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PHOTO_KINDS, INSPECTION_KINDS, DOCUMENT_KINDS, choice } from '../common/validation';
import { createHash, randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const PRIVATE_DOCUMENT_KINDS = new Set(['AADHAAR', ...DOCUMENT_KINDS]);

@Injectable()
export class MediaService {
  private s3?: S3Client;
  constructor(private prisma: PrismaService) {}
  private directory() { return resolve(process.env.UPLOAD_DIR || './uploads'); }
  private bucket() { return process.env.S3_BUCKET?.trim() || ''; }
  private prefix() { return (process.env.S3_PREFIX || 'safar-media').replace(/^\/+|\/+$/g, ''); }
  private objectKey(fileName: string) { return `${this.prefix()}/${fileName}`; }
  private objectStorageEnabled() { return Boolean(this.bucket() && process.env.AWS_REGION); }
  private client() {
    if (!this.objectStorageEnabled()) return undefined;
    if (!this.s3) this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
    return this.s3;
  }
  private async writeStorage(storageKey: string, buffer: Buffer, mimeType: string) {
    const client = this.client();
    if (client) {
      await client.send(new PutObjectCommand({ Bucket: this.bucket(), Key: storageKey, Body: buffer, ContentType: mimeType, ServerSideEncryption: 'AES256' }));
      return;
    }
    await mkdir(this.directory(), { recursive: true });
    await writeFile(resolve(this.directory(), storageKey), buffer, { flag: 'wx' });
  }
  private async removeStorage(storageKey: string) {
    const client = this.client();
    if (client && storageKey.startsWith(this.prefix() + '/')) {
      await client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: storageKey }));
      return;
    }
    await unlink(resolve(this.directory(), storageKey)).catch(() => undefined);
  }
  private async readStorage(storageKey: string) {
    const client = this.client();
    if (client && storageKey.startsWith(this.prefix() + '/')) {
      const result = await client.send(new GetObjectCommand({ Bucket: this.bucket(), Key: storageKey }));
      if (!result.Body) throw new ServiceUnavailableException('Stored media is unavailable');
      return Buffer.from(await result.Body.transformToByteArray());
    }
    return readFile(resolve(this.directory(), storageKey));
  }
  private key() {
    const key = process.env.DOCUMENT_ENCRYPTION_KEY || '';
    if (!/^[a-f0-9]{64}$/i.test(key)) throw new ServiceUnavailableException('Private document storage is not configured');
    return Buffer.from(key, 'hex');
  }
  async upload(userId: string, kindInput: string, file: any) {
    const kind = choice(kindInput, 'Photo/document type', [...PHOTO_KINDS, ...INSPECTION_KINDS, ...DOCUMENT_KINDS]);
    if (!file?.buffer || file.size > 8 * 1024 * 1024) throw new BadRequestException('Upload a JPEG, PNG or WebP image up to 8 MB');
    let buffer: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'error' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error();
      buffer = await input.rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    } catch { throw new BadRequestException('Invalid image. Use a single JPEG, PNG or WebP image under 25 megapixels.'); }
    const isPrivate = DOCUMENT_KINDS.includes(kind as any);
    if (isPrivate) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
      buffer = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    }
    const storageKey = this.objectStorageEnabled() ? this.objectKey(randomUUID() + (isPrivate ? '.enc' : '.jpg')) : randomUUID() + (isPrivate ? '.enc' : '.jpg');
    await this.writeStorage(storageKey, buffer, 'image/jpeg');
    try {
      const result = await this.prisma.media.create({ data: { ownerId: userId, kind, storageKey, mimeType: 'image/jpeg', size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') } });
      return { id: result.id, kind, url: '/api/media/' + result.id };
    } catch (e) { await this.removeStorage(storageKey); throw e; }
  }
  async storePrivateDocument(ownerId: string, kindInput: string, buffer: Buffer, mimeType: string) {
    const kind = choice(kindInput, 'Document type', [...PRIVATE_DOCUMENT_KINDS]);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 12 * 1024 * 1024) throw new BadRequestException('Provider document is empty or exceeds the 12 MB limit');
    if (typeof mimeType !== 'string' || !/^(application\/(pdf|xml|octet-stream)|text\/xml|image\/(jpeg|png|webp))$/i.test(mimeType)) throw new BadRequestException('Provider returned an unsupported document format');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const stored = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    const storageKey = this.objectStorageEnabled() ? this.objectKey(randomUUID() + '.enc') : randomUUID() + '.enc';
    await this.writeStorage(storageKey, stored, mimeType.toLowerCase());
    try {
      const result = await this.prisma.media.create({ data: { ownerId, kind, storageKey, mimeType: mimeType.toLowerCase(), size: stored.length, sha256: createHash('sha256').update(stored).digest('hex') } });
      return result.id;
    } catch (e) { await this.removeStorage(storageKey); throw e; }
  }
  async read(id: string, user?: { id: string; role: string }) {
    const media = await this.prisma.media.findUnique({ where: { id }, include: { vehicle: { select: { status: true } } } });
    if (!media) throw new NotFoundException('Image not found');
    const isPrivate = PRIVATE_DOCUMENT_KINDS.has(media.kind);
    const publicPhoto = !isPrivate && media.vehicle?.status === 'ACTIVE';
    if (!publicPhoto && (!user || (user.id !== media.ownerId && user.role !== 'ADMIN'))) throw new ForbiddenException('Image access denied');
    let buffer = await this.readStorage(media.storageKey);
    if (isPrivate) {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      buffer = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
    }
    return { buffer, mimeType: media.mimeType };
  }
}

