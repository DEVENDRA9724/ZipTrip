import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VehiclesService } from './vehicles.service';
import { BookingsService } from '../bookings/bookings.service';
import { AdminController } from '../admin/admin.controller';
import { MediaService } from '../media/media.service';
import { memoryObjectStorage } from '../media/object-storage';
const Database = require('better-sqlite3');

// Characterisation of the public eligibility guarantees from Phase 5, kept passing through the Phase 6
// approval/availability split (docs/VEHICLE_APPROVAL_AVAILABILITY_PLAN.md). Each car carries the state the backfill
// gives its former single status.
describe('Public vehicle eligibility against an isolated database', () => {
  let directory: string,
    prisma: PrismaClient,
    vehicles: VehiclesService,
    bookings: BookingsService,
    admin: AdminController;
  const previousStorage = process.env.MEDIA_STORAGE;
  const day = 86400000;
  const start = new Date(Date.now() + 30 * day),
    end = new Date(+start + 2 * day);
  const period = { startDate: start.toISOString(), endDate: end.toISOString() };
  const reqB = { user: { id: 'admin-b', role: 'ADMIN' } };
  let key = 0;
  const split: Record<string, [string, string, string | null]> = {
    ACTIVE: ['APPROVED', 'ACTIVE', null],
    INACTIVE: ['APPROVED', 'INACTIVE', 'ADMIN_SUSPENDED'],
    MAINTENANCE: ['APPROVED', 'INACTIVE', 'MAINTENANCE'],
    PENDING_APPROVAL: ['PENDING_APPROVAL', 'INACTIVE', null],
  };
  const book = (vehicleId: string) =>
    bookings.create('customer', {
      vehicleId,
      requestKey: 'k' + ++key,
      ...period,
    });

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-eligibility-'));
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
    bookings = new BookingsService(prisma as any);
    const evidence = {
      available: async (doc: any) => ({ documentId: doc.id, files: [] }),
    };
    admin = new AdminController(prisma as any, evidence as any, vehicles);
    for (const [id, role, extra] of [
      ['host', 'HOST', {}],
      ['admin-b', 'ADMIN', {}],
      [
        'customer',
        'CUSTOMER',
        { isVerified: true, dlValidUntil: new Date(Date.now() + 365 * day) },
      ],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          email: id + '@example.invalid',
          passwordHash: 'test-only',
          firstName: 'T',
          lastName: id,
          role: role as any,
          ...extra,
        },
      });
    const cars: [
      string,
      string,
      'valid' | 'expiring' | 'none' | 'rc-rejected',
    ][] = [
      ['ok', 'ACTIVE', 'valid'],
      ['inactive', 'INACTIVE', 'valid'],
      ['maintenance', 'MAINTENANCE', 'valid'],
      ['pending', 'PENDING_APPROVAL', 'valid'],
      ['expiring', 'ACTIVE', 'expiring'],
      ['no-docs', 'ACTIVE', 'none'],
      ['rc-rejected', 'ACTIVE', 'rc-rejected'],
      ['review-me', 'ACTIVE', 'valid'],
    ];
    for (const [id, status, docs] of cars) {
      await prisma.vehicle.create({
        data: {
          id,
          hostId: 'host',
          make: 'Test',
          model: id,
          year: 2024,
          category: 'SUV',
          transmission: 'Manual',
          fuelType: 'Petrol',
          seats: 5,
          pricePerDay: 1500,
          status: status as any,
          approvalStatus: split[status][0],
          availability: split[status][1],
          availabilityReason: split[status][2],
          locationCity: 'Surat',
          registrationNumber:
            'GJ05EL' + id.length + id.slice(0, 3).toUpperCase(),
          images: '[]',
        },
      });
      if (docs === 'none') continue;
      for (const kind of ['RC', 'INSURANCE', 'PUC'])
        await prisma.document.create({
          data: {
            id: `${id}-${kind}`,
            userId: 'host',
            vehicleId: id,
            kind,
            mediaId: `${id}-${kind}-file`,
            status:
              docs === 'rc-rejected' && kind === 'RC' ? 'REJECTED' : 'APPROVED',
            validUntil: new Date(
              docs === 'expiring' ? +start + day : Date.now() + 365 * day,
            ),
          },
        });
    }
    await memoryObjectStorage().put(
      'pending-front.jpg',
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      'image/jpeg',
    );
    await prisma.media.create({
      data: {
        id: 'pending-photo',
        ownerId: 'host',
        vehicleId: 'pending',
        kind: 'FRONT',
        storageKey: 'pending-front.jpg',
        mimeType: 'image/jpeg',
        size: 4,
        sha256: 'x',
      },
    });
    await prisma.booking.create({
      data: {
        id: 'existing',
        bookingRef: 'EXISTING',
        vehicleId: 'review-me',
        customerId: 'customer',
        startDate: new Date(Date.now() + 60 * day),
        endDate: new Date(Date.now() + 61 * day),
        totalAmount: 3000,
        status: 'CONFIRMED',
      },
    });
  });
  afterAll(async () => {
    if (previousStorage === undefined) delete process.env.MEDIA_STORAGE;
    else process.env.MEDIA_STORAGE = previousStorage;
    await prisma?.$disconnect();
    if (directory && directory.startsWith(join(tmpdir(), 'safar-eligibility-')))
      rmSync(directory, { recursive: true });
  });

  it('lists, shows, quotes and books only APPROVED, ACTIVE cars with compliance valid through the return date', async () => {
    expect(
      (await vehicles.findAll({ ...period, city: 'Surat' }))
        .map((v) => v.id)
        .sort(),
    ).toEqual(['ok', 'review-me']);
    for (const id of ['inactive', 'maintenance', 'pending']) {
      await expect(vehicles.findOne(id)).rejects.toThrow('not found');
      await expect(vehicles.quote(id, period)).rejects.toThrow();
      await expect(book(id)).rejects.toThrow('not available');
    }
    for (const id of ['expiring', 'no-docs', 'rc-rejected'])
      await expect(book(id)).rejects.toThrow('documents');
    expect((await book('ok')).status).toBe('PENDING');
  });

  it('only shows car photos publicly while the car is ACTIVE', async () => {
    const media = new MediaService(prisma as any);
    await expect(media.read('pending-photo')).rejects.toThrow(
      'Image access denied',
    );
    expect(
      (await media.read('pending-photo', { id: 'host', role: 'HOST' }))
        .mimeType,
    ).toBe('image/jpeg');
  });

  it('cannot activate a car without approved compliance, and never through self-review', async () => {
    await prisma.vehicle.update({
      where: { id: 'no-docs' },
      data: { approvalStatus: 'PENDING_APPROVAL', availability: 'INACTIVE' },
    });
    await expect(
      admin.vehicle(reqB, 'no-docs', {
        status: 'ACTIVE',
        note: 'no documents',
      }),
    ).rejects.toThrow('All required photos');
    await prisma.vehicle.update({
      where: { id: 'pending' },
      data: { hostId: 'admin-b' },
    });
    await expect(
      admin.vehicle(reqB, 'pending', { status: 'ACTIVE', note: 'own car' }),
    ).rejects.toThrow('Another administrator');
    await prisma.vehicle.update({
      where: { id: 'pending' },
      data: { hostId: 'host' },
    });
  });

  it('rejecting a vehicle document takes the car off the public listing and keeps existing bookings', async () => {
    await admin.evidence(reqB, 'review-me-PUC');
    await admin.review(reqB, 'review-me-PUC', {
      status: 'REJECTED',
      note: 'Expired certificate',
    });
    expect(
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: 'review-me' } }))
        .status,
    ).toBe('PENDING_APPROVAL');
    // ('ok' is held by the booking made in the first test, so only the reviewed car is asserted here.)
    expect(
      (await vehicles.findAll({ city: 'Surat' })).map((v) => v.id),
    ).not.toContain('review-me');
    expect(
      await prisma.booking.findUniqueOrThrow({ where: { id: 'existing' } }),
    ).toMatchObject({ status: 'CONFIRMED', vehicleId: 'review-me' });
    expect(
      await prisma.auditLog.count({
        where: { action: 'BOOKING_REVIEW_FLAGGED', targetId: 'existing' },
      }),
    ).toBe(1);
  });
});
