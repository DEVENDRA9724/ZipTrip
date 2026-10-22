import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { KycController } from './kyc.controller';
import { MediaService } from '../media/media.service';
const Database = require('better-sqlite3');

describe('Vehicle document uploads against an isolated database', () => {
  let directory: string,
    prisma: PrismaClient,
    kyc: KycController,
    media: MediaService;
  const previous = {
    key: process.env.DOCUMENT_ENCRYPTION_KEY,
    storage: process.env.MEDIA_STORAGE,
  };
  const hostA = { id: 'host-a', role: 'HOST' },
    hostB = { id: 'host-b', role: 'HOST' },
    dealer = { id: 'dealer', role: 'DEALER' },
    admin = { id: 'admin', role: 'ADMIN' };
  let image: Buffer;
  const upload = async (user: { id: string }, kind: string) =>
    (await media.upload(user.id, kind, { buffer: image, size: image.length }))
      .id;
  const submit = (user: any, body: any) =>
    kyc.document({ user }, { consent: true, ...body });

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-vehicle-docs-'));
    process.env.DOCUMENT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    process.env.MEDIA_STORAGE = 'memory';
    const filename = join(directory, 'test.db');
    const db = new Database(filename);
    db.exec(
      readFileSync(
        join(process.cwd(), 'test/fixtures/sqlite-schema.sql'),
        'utf8',
      ),
    );
    db.close();
    prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: 'file:' + filename }),
    });
    media = new MediaService(prisma as any);
    kyc = new KycController(prisma as any, {} as any, {} as any);
    image = await sharp({
      create: { width: 64, height: 40, channels: 3, background: '#3b1259' },
    })
      .jpeg()
      .toBuffer();
    for (const [id, role] of [
      ['host-a', 'HOST'],
      ['host-b', 'HOST'],
      ['dealer', 'DEALER'],
      ['admin', 'ADMIN'],
      ['customer', 'CUSTOMER'],
    ])
      await prisma.user.create({
        data: {
          id,
          email: id + '@example.invalid',
          passwordHash: 'test-only',
          firstName: 'Test',
          lastName: id,
          role: role as any,
        },
      });
    for (const [id, hostId, status] of [
      ['car-a', 'host-a', 'ACTIVE'],
      ['car-b', 'host-b', 'PENDING_APPROVAL'],
      ['car-dealer', 'dealer', 'PENDING_APPROVAL'],
      ['car-admin', 'admin', 'PENDING_APPROVAL'],
    ])
      await prisma.vehicle.create({
        data: {
          id,
          hostId,
          make: 'Test',
          model: id,
          year: 2024,
          category: 'SUV',
          transmission: 'Automatic',
          fuelType: 'Petrol',
          seats: 5,
          pricePerDay: 2000,
          status: status as any,
          locationCity: 'Ahmedabad',
          images: '[]',
        },
      });
    await prisma.document.create({
      data: {
        id: 'approved-rc',
        userId: 'host-a',
        vehicleId: 'car-a',
        kind: 'RC',
        status: 'APPROVED',
        reviewNote: 'Checked',
        validUntil: new Date('2030-01-01'),
      },
    });
  });
  afterAll(async () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = previous.key;
    process.env.MEDIA_STORAGE = previous.storage;
    if (previous.key === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY;
    if (previous.storage === undefined) delete process.env.MEDIA_STORAGE;
    await prisma?.$disconnect();
    if (
      directory &&
      directory.startsWith(join(tmpdir(), 'safar-vehicle-docs-'))
    )
      rmSync(directory, { recursive: true });
  });

  it.each(['RC', 'INSURANCE', 'PUC'])(
    'lets an owner submit %s for their own car as a pending, unapproved record',
    async (kind) => {
      const doc = await submit(hostA, {
        kind,
        mediaId: await upload(hostA, kind),
        vehicleId: 'car-a',
      });
      expect(doc).toMatchObject({
        kind,
        vehicleId: 'car-a',
        userId: 'host-a',
        status: 'PENDING',
        validUntil: null,
      });
    },
  );

  it('supports DEALER fleet accounts on their own vehicles', async () => {
    const doc = await submit(dealer, {
      kind: 'PUC',
      mediaId: await upload(dealer, 'PUC'),
      vehicleId: 'car-dealer',
    });
    expect(doc).toMatchObject({ vehicleId: 'car-dealer', status: 'PENDING' });
  });

  it('requires a vehicle for RC, Insurance and PUC', async () => {
    await expect(
      submit(hostA, {
        kind: 'INSURANCE',
        mediaId: await upload(hostA, 'INSURANCE'),
      }),
    ).rejects.toThrow('Vehicle is required');
    await expect(
      submit(hostA, {
        kind: 'INSURANCE',
        mediaId: await upload(hostA, 'INSURANCE'),
        vehicleId: '',
      }),
    ).rejects.toThrow('Vehicle is required');
  });

  it('rejects unsupported document categories and mismatched uploads', async () => {
    const mediaId = await upload(hostA, 'RC');
    for (const kind of ['AADHAAR', 'PASSPORT', 'rc', ''])
      await expect(
        submit(hostA, { kind, mediaId, vehicleId: 'car-a' }),
      ).rejects.toThrow('Invalid Document type');
    await expect(
      submit(hostA, { kind: 'PUC', mediaId, vehicleId: 'car-a' }),
    ).rejects.toThrow('Upload your document first');
    await expect(
      media.upload('host-a', 'PASSPORT', { buffer: image, size: image.length }),
    ).rejects.toThrow('Invalid Photo/document type');
  });

  it('rejects another owner’s vehicle without revealing it, and administrators follow the same ownership rule', async () => {
    const before = await prisma.document.count();
    await expect(
      submit(hostA, {
        kind: 'RC',
        mediaId: await upload(hostA, 'RC'),
        vehicleId: 'car-b',
      }),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      submit(hostA, {
        kind: 'RC',
        mediaId: await upload(hostA, 'RC'),
        vehicleId: 'no-such-car',
      }),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      submit(admin, {
        kind: 'RC',
        mediaId: await upload(admin, 'RC'),
        vehicleId: 'car-b',
      }),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      submit(
        { id: 'customer', role: 'CUSTOMER' },
        {
          kind: 'RC',
          mediaId: await upload({ id: 'customer' }, 'RC'),
          vehicleId: 'car-a',
        },
      ),
    ).rejects.toThrow('Your vehicle was not found');
    // Another owner's uploaded file cannot be attached either.
    await expect(
      submit(hostB, {
        kind: 'RC',
        mediaId: await upload(hostA, 'RC'),
        vehicleId: 'car-b',
      }),
    ).rejects.toThrow('Upload your document first');
    expect(await prisma.document.count()).toBe(before);
    expect(
      await submit(admin, {
        kind: 'RC',
        mediaId: await upload(admin, 'RC'),
        vehicleId: 'car-admin',
      }),
    ).toMatchObject({ status: 'PENDING' });
  });

  it('rejects unsupported file content and oversized files on the server', async () => {
    await expect(
      media.upload('host-a', 'RC', {
        buffer: Buffer.from('<svg onload=alert(1)>'),
        size: 21,
      }),
    ).rejects.toThrow('Invalid image');
    await expect(
      media.upload('host-a', 'RC', {
        buffer: Buffer.from('%PDF-1.7'),
        size: 8,
      }),
    ).rejects.toThrow('Invalid image');
    await expect(
      media.upload('host-a', 'RC', {
        buffer: image,
        size: 8 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('up to 8 MB');
    await expect(media.upload('host-a', 'RC', undefined)).rejects.toThrow(
      'up to 8 MB',
    );
  });

  it('requires consent and refuses to reuse an already submitted file', async () => {
    const mediaId = await upload(hostA, 'PUC');
    await expect(
      kyc.document(
        { user: hostA },
        { kind: 'PUC', mediaId, vehicleId: 'car-a' },
      ),
    ).rejects.toThrow('Consent');
    await submit(hostA, { kind: 'PUC', mediaId, vehicleId: 'car-a' });
    await expect(
      submit(hostA, { kind: 'PUC', mediaId, vehicleId: 'car-a' }),
    ).rejects.toThrow('already been submitted');
  });

  it('leaves existing document reviews and vehicle status unchanged', async () => {
    expect(
      await prisma.document.findUniqueOrThrow({ where: { id: 'approved-rc' } }),
    ).toMatchObject({ status: 'APPROVED', reviewNote: 'Checked' });
    expect(
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: 'car-a' } }))
        .status,
    ).toBe('ACTIVE');
    expect(
      await prisma.document.count({
        where: { vehicleId: 'car-a', status: 'APPROVED' },
      }),
    ).toBe(1);
  });
});
