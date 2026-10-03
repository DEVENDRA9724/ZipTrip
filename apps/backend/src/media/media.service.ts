import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PHOTO_KINDS, DOCUMENT_KINDS, choice } from '../common/validation';
import { createHash, randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}
  private directory() { return resolve(process.env.UPLOAD_DIR || './uploads'); }
  private key() {
    const key = process.env.DOCUMENT_ENCRYPTION_KEY || '';
    if (!/^[a-f0-9]{64}$/i.test(key)) throw new ServiceUnavailableException('Private document storage is not configured');
    return Buffer.from(key, 'hex');
  }
  async upload(userId: string, kindInput: string, file: any) {
    const kind = choice(kindInput, 'Photo/document type', [...PHOTO_KINDS, ...DOCUMENT_KINDS]);
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
    await mkdir(this.directory(), { recursive: true });
    const path = resolve(this.directory(), storageKey);
    await writeFile(path, buffer, { flag: 'wx' });
    try {
      const result = await this.prisma.media.create({ data: { ownerId: userId, kind, storageKey, mimeType: 'image/jpeg', size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') } });
      return { id: result.id, kind, url: '/api/media/' + result.id };
    } catch (e) { await unlink(path); throw e; }
  }
  async read(id: string, user?: { id: string; role: string }) {
    const media = await this.prisma.media.findUnique({ where: { id }, include: { vehicle: { select: { status: true } } } });
    if (!media) throw new NotFoundException('Image not found');
    const isPrivate = DOCUMENT_KINDS.includes(media.kind as any);
    const publicPhoto = !isPrivate && media.vehicle?.status === 'ACTIVE';
    if (!publicPhoto && (!user || (user.id !== media.ownerId && user.role !== 'ADMIN'))) throw new ForbiddenException('Image access denied');
    let buffer = await readFile(resolve(this.directory(), media.storageKey));
    if (isPrivate) {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      buffer = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
    }
    return { buffer, mimeType: media.mimeType };
  }
}

