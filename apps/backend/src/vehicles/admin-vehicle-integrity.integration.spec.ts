import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { VehiclesService } from './vehicles.service';
import { AdminController } from '../admin/admin.controller';
import { KycController } from '../kyc/kyc.controller';
import { MediaService } from '../media/media.service';
import { BookingsService } from '../bookings/bookings.service';
import { PHOTO_KINDS } from '../common/validation';
const Database = require('better-sqlite3');

describe('Admin-created vehicle integrity against an isolated database', () => {
  let directory: string,
    prisma: PrismaClient,
    vehicles: VehiclesService,
    adminA: AdminController,
    adminB: AdminController,
    kyc: KycController,
    media: MediaService;
  const previous = {
    key: process.env.DOCUMENT_ENCRYPTION_KEY,
    storage: process.env.MEDIA_STORAGE,
  };
  const reqA = { user: { id: 'admin-a', role: 'ADMIN' } },
    reqB = { user: { id: 'admin-b', role: 'ADMIN' } },
    reqHost = { user: { id: 'host', role: 'HOST' } };
  const listing = (registrationNumber: string, extra: any = {}) => ({
    make: 'Hyundai',
    model: 'Verna',
    year: 2024,
    registrationNumber,
    city: 'Ahmedabad',
    category: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seats: 5,
    pricePerDay: 1800,
    odometer: 1200,
    ...extra,
  });
  let colour = 0;
  // A distinct real image per upload so the duplicate-photo rule is satisfied.
  const image = () =>
    sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: (colour += 23) % 255, g: 90, b: 140 },
      },
    })
      .jpeg()
      .toBuffer();
  const upload = async (userId: string, kind: string) => {
    const buffer = await image();
    return (await media.upload(userId, kind, { buffer, size: buffer.length }))
      .id;
  };
  const period = () => {
    const start = new Date(Date.now() + 20 * 86400000);
    return {
      startDate: start.toISOString(),
      endDate: new Date(+start + 2 * 86400000).toISOString(),
    };
  };

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-admin-vehicle-'));
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
    vehicles = new VehiclesService(prisma as any);
    // Evidence retrieval is provider/storage specific; the review gate only needs the DOCUMENT_VIEWED audit it writes.
    const evidence = {
      available: async (doc: any) => ({
        documentId: doc.id,
        files: [{ url: '/api/media/' + doc.mediaId }],
      }),
    };
    adminA = new AdminController(prisma as any, evidence as any, vehicles);
    adminB = adminA;
    kyc = new KycController(prisma as any, {} as any, {} as any);
    media = new MediaService(prisma as any);
    for (const [id, role, extra] of [
      ['admin-a', 'ADMIN', {}],
      ['admin-b', 'ADMIN', {}],
      ['host', 'HOST', {}],
      [
        'customer',
        'CUSTOMER',
        {
          isVerified: true,
          dlValidUntil: new Date(Date.now() + 365 * 86400000),
        },
      ],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          email: id + '@example.invalid',
          passwordHash: 'test-only',
          firstName: 'Test',
          lastName: id,
          role: role as any,
          ...extra,
        },
      });
    // A pre-existing, legitimately approved host car with a booking, which admin fleet work must not disturb.
    await prisma.vehicle.create({
      data: {
        id: 'legacy-car',
        hostId: 'host',
        make: 'Kia',
        model: 'Sonet',
        year: 2023,
        category: 'SUV',
        transmission: 'Manual',
        fuelType: 'Diesel',
        seats: 5,
        pricePerDay: 2100,
        status: 'ACTIVE',
        locationCity: 'Surat',
        images: '[]',
      },
    });
    await prisma.booking.create({
      data: {
        id: 'legacy-booking',
        bookingRef: 'LEGACY-1',
        vehicleId: 'legacy-car',
        customerId: 'customer',
        startDate: new Date(Date.now() + 40 * 86400000),
        endDate: new Date(Date.now() + 41 * 86400000),
        totalAmount: 4100,
        status: 'CONFIRMED',
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
      directory.startsWith(join(tmpdir(), 'safar-admin-vehicle-'))
    )
      rmSync(directory, { recursive: true });
  });

  it('creates a vehicle without photos as pending, with no invented photos or documents, hidden from the public', async () => {
    const car = await adminA.createVehicle(reqA, listing('GJ01AD0001'));
    expect(car).toMatchObject({
      status: 'PENDING_APPROVAL',
      hostId: 'admin-a',
      images: '[]',
      transmission: 'Automatic',
      fuelType: 'Petrol',
    });
    expect(await prisma.media.count({ where: { vehicleId: car.id } })).toBe(0);
    expect(await prisma.document.count({ where: { vehicleId: car.id } })).toBe(
      0,
    );
    expect(
      JSON.parse(
        (
          await prisma.auditLog.findFirstOrThrow({
            where: { action: 'VEHICLE_CREATED_BY_ADMIN', targetId: car.id },
          })
        ).detail,
      ),
    ).toMatchObject({ status: 'PENDING_APPROVAL', photoKinds: [] });
    expect((await vehicles.findAll({})).map((v) => v.id)).not.toContain(car.id);
    await expect(vehicles.findOne(car.id)).rejects.toThrow('not found');
    await expect(vehicles.quote(car.id, period())).rejects.toThrow();
    await expect(
      new BookingsService(prisma as any).create('customer', {
        vehicleId: car.id,
        requestKey: 'pending-car',
        ...period(),
      }),
    ).rejects.toThrow('not available');
  });

  it('links a legitimately uploaded photo and an https image without fabricating the rest', async () => {
    const front = await upload('admin-a', 'FRONT');
    const car = await adminA.createVehicle(
      reqA,
      listing('GJ01AD0002', {
        mediaIds: [front],
        images: 'https://cdn.example.com/verna.jpg',
      }),
    );
    expect(JSON.parse(car.images)).toEqual([
      '/api/media/' + front,
      'https://cdn.example.com/verna.jpg',
    ]);
    expect(
      await prisma.media.findMany({
        where: { vehicleId: car.id },
        select: { id: true, kind: true },
      }),
    ).toEqual([{ id: front, kind: 'FRONT' }]);
    await expect(
      adminA.createVehicle(reqA, listing('GJ01AD0003', { mediaIds: [front] })),
    ).rejects.toThrow('unlinked vehicle photos');
    await expect(
      adminA.createVehicle(
        reqA,
        listing('GJ01AD0004', { mediaIds: [await upload('admin-a', 'RC')] }),
      ),
    ).rejects.toThrow('unlinked vehicle photos');
    await expect(
      adminA.createVehicle(
        reqA,
        listing('GJ01AD0005', { mediaIds: [await upload('host', 'REAR')] }),
      ),
    ).rejects.toThrow('unlinked vehicle photos');
    await expect(
      adminA.createVehicle(
        reqA,
        listing('GJ01AD0006', { images: 'javascript:alert(1)' }),
      ),
    ).rejects.toThrow('https://');
    await expect(
      adminA.createVehicle(
        reqA,
        listing('GJ01AD0007', { transmission: 'AUTOMATIC' }),
      ),
    ).rejects.toThrow('Invalid Transmission');
    expect(
      await prisma.vehicle.count({
        where: {
          registrationNumber: {
            in: [
              'GJ01AD0003',
              'GJ01AD0004',
              'GJ01AD0005',
              'GJ01AD0006',
              'GJ01AD0007',
            ],
          },
        },
      }),
    ).toBe(0);
  });

  it('refuses vehicle creation by non-administrators', async () => {
    await expect(
      adminA.createVehicle(reqHost, listing('GJ01AD0008')),
    ).rejects.toThrow('Administrator access required');
  });

  it('keeps documents pending until a different administrator approves them from evidence, and gates activation on real compliance', async () => {
    const car = await prisma.vehicle.findUniqueOrThrow({
      where: { registrationNumber: 'GJ01AD0002' },
    });
    const docs: Record<string, string> = {};
    for (const kind of ['RC', 'INSURANCE', 'PUC']) {
      const doc = await kyc.document(
        { user: reqA.user },
        {
          kind,
          mediaId: await upload('admin-a', kind),
          vehicleId: car.id,
          consent: true,
        },
      );
      expect(doc).toMatchObject({ status: 'PENDING', validUntil: null });
      docs[kind] = doc.id;
    }
    // Self-review and self-approval are refused at every step.
    await adminA.evidence(reqA, docs.RC);
    await expect(
      adminA.review(reqA, docs.RC, {
        status: 'APPROVED',
        note: 'own',
        identityChecked: true,
        validUntil: '2031-01-01',
      }),
    ).rejects.toThrow(
      'Another administrator must review documents you submitted',
    );
    await expect(
      adminA.vehicle(reqA, car.id, { status: 'ACTIVE', note: 'own listing' }),
    ).rejects.toThrow('Another administrator must review your listing');
    await expect(
      adminA.vehicle(reqHost, car.id, { status: 'ACTIVE', note: 'host' }),
    ).rejects.toThrow('Administrator access required');
    // A second administrator still cannot activate a car with missing photos or unapproved documents.
    await expect(
      adminB.vehicle(reqB, car.id, { status: 'ACTIVE', note: 'too early' }),
    ).rejects.toThrow('All required photos');
    await expect(
      adminB.review(reqB, docs.RC, {
        status: 'APPROVED',
        note: 'unseen',
        identityChecked: true,
        validUntil: '2031-01-01',
      }),
    ).rejects.toThrow('inspect this record');
    for (const id of Object.values(docs)) {
      await adminB.evidence(reqB, id);
      expect(
        (
          await adminB.review(reqB, id, {
            status: 'APPROVED',
            note: 'Checked original',
            identityChecked: true,
            validUntil: '2031-01-01',
          })
        ).status,
      ).toBe('APPROVED');
    }
    // Complete the photo set through the pending-listing photo workflow.
    await expect(
      vehicles.addPhotos('host', car.id, {
        mediaIds: [await upload('host', 'REAR')],
      }),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      vehicles.addPhotos('admin-a', car.id, {
        mediaIds: [await upload('admin-a', 'FRONT')],
      }),
    ).rejects.toThrow('only be added once');
    const remaining = await Promise.all(
      PHOTO_KINDS.filter((k) => k !== 'FRONT').map((k) => upload('admin-a', k)),
    );
    const updated = await vehicles.addPhotos('admin-a', car.id, {
      mediaIds: remaining,
    });
    expect(updated.media).toHaveLength(8);
    expect(JSON.parse(updated.images)).toHaveLength(9);
    expect(
      (
        await adminB.vehicle(reqB, car.id, {
          status: 'ACTIVE',
          note: 'Evidence reviewed',
        })
      )?.status,
    ).toBe('ACTIVE');
    expect((await vehicles.findAll({})).map((v) => v.id)).toContain(car.id);
    await expect(
      vehicles.addPhotos('admin-a', car.id, {
        mediaIds: [await upload('admin-a', 'FRONT')],
      }),
    ).rejects.toThrow('awaiting approval');
    // Inactive cars leave the public listing but keep their bookings.
    await prisma.booking.create({
      data: {
        id: 'admin-car-booking',
        bookingRef: 'ADMIN-1',
        vehicleId: car.id,
        customerId: 'customer',
        startDate: new Date(Date.now() + 50 * 86400000),
        endDate: new Date(Date.now() + 51 * 86400000),
        totalAmount: 3600,
        status: 'CONFIRMED',
      },
    });
    await adminB.vehicle(reqB, car.id, { status: 'INACTIVE', note: 'Paused' });
    expect((await vehicles.findAll({})).map((v) => v.id)).not.toContain(car.id);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: 'admin-car-booking' },
      }),
    ).toMatchObject({ status: 'CONFIRMED', totalAmount: expect.anything() });
  });

  it('leaves existing vehicles, bookings and documents untouched', async () => {
    expect(
      await prisma.vehicle.findUniqueOrThrow({ where: { id: 'legacy-car' } }),
    ).toMatchObject({
      status: 'ACTIVE',
      hostId: 'host',
      pricePerDay: expect.anything(),
    });
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: 'legacy-booking' },
      }),
    ).toMatchObject({ status: 'CONFIRMED', vehicleId: 'legacy-car' });
    expect(
      await prisma.document.count({ where: { source: 'ADMIN_FLEET_UPLOAD' } }),
    ).toBe(0);
    expect(
      await prisma.media.count({
        where: { storageKey: { startsWith: 'fleet-' } },
      }),
    ).toBe(0);
  });
});
