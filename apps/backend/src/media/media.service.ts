import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PHOTO_KINDS, INSPECTION_KINDS, DOCUMENT_KINDS, choice } from '../common/validation';
import { createHash, randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { objectStorage } from './object-storage';
import sharp from 'sharp';

const PRIVATE_DOCUMENT_KINDS = new Set(['AADHAAR', ...DOCUMENT_KINDS]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(private prisma: PrismaService) {}
  // Files are stored in S3 only (see object-storage.ts); the database keeps the object key and checksum.
  private get storage() { return objectStorage(); }
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
    const storageKey = randomUUID() + (isPrivate ? '.enc' : '.jpg');
    await this.storage.put(storageKey, buffer, isPrivate ? 'application/octet-stream' : 'image/jpeg');
    try {
      const result = await this.prisma.media.create({ data: { ownerId: userId, kind, storageKey, mimeType: 'image/jpeg', size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') } });
      return { id: result.id, kind, url: '/api/media/' + result.id };
    } catch (e) { await this.storage.remove(storageKey).catch(() => undefined); throw e; }
  }
  async storePrivateDocument(ownerId: string, kindInput: string, buffer: Buffer, mimeType: string) {
    const kind = choice(kindInput, 'Document type', [...PRIVATE_DOCUMENT_KINDS]);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 12 * 1024 * 1024) throw new BadRequestException('Provider document is empty or exceeds the 12 MB limit');
    if (typeof mimeType !== 'string' || !/^(application\/(pdf|xml|octet-stream)|text\/xml|image\/(jpeg|png|webp))$/i.test(mimeType)) throw new BadRequestException('Provider returned an unsupported document format');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const stored = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    const storageKey = randomUUID() + '.enc';
    await this.storage.put(storageKey, stored, 'application/octet-stream');
    try {
      const result = await this.prisma.media.create({ data: { ownerId, kind, storageKey, mimeType: mimeType.toLowerCase(), size: stored.length, sha256: createHash('sha256').update(stored).digest('hex') } });
      return result.id;
    } catch (e) { await this.storage.remove(storageKey).catch(() => undefined); throw e; }
  }
  async read(id: string, user?: { id: string; role: string }) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      include: {
        vehicle: { select: { approvalStatus: true, availability: true } },
      },
    });
    if (!media) throw new NotFoundException('Image not found');
    const isPrivate = PRIVATE_DOCUMENT_KINDS.has(media.kind);
    // Car photos are public only while the car is publicly listed (approved and active).
    const publicPhoto =
      !isPrivate &&
      media.vehicle?.approvalStatus === 'APPROVED' &&
      media.vehicle?.availability === 'ACTIVE';
    if (!publicPhoto && (!user || (user.id !== media.ownerId && user.role !== 'ADMIN'))) throw new ForbiddenException('Image access denied');
    let buffer = await this.storage.get(media.storageKey);
    if (!buffer) {
      // A record whose object is gone is reported as not found; the storage key is never logged or returned.
      this.logger.warn(`Media ${media.id} has no stored file`);
      throw new NotFoundException('Image not found');
    }
    if (isPrivate) {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      buffer = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
    }
    return { buffer, mimeType: media.mimeType, kind: media.kind };
  }
}

