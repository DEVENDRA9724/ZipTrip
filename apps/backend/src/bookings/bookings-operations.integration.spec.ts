import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BookingsService } from './bookings.service';
import { HoldExpiryService, HOLD_EXPIRED } from './hold-expiry.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountService } from '../account/account.service';
import { AdminController } from '../admin/admin.controller';
const Database = require('better-sqlite3');

describe('Booking operations against an isolated database', () => {
  let directory: string, prisma: PrismaClient, bookings: BookingsService;
  const hour = 3600000,
    day = 24 * hour;
  const futureStart = new Date(Date.now() + 10 * day);
  const futureEnd = new Date(+futureStart + 2 * day);
  const booking = (data: any) =>
    prisma.booking.create({
      data: {
        vehicleId: 'car',
        customerId: 'customer',
        totalAmount: 6000,
        startDate: futureStart,
        endDate: futureEnd,
        ...data,
      },
    });
  const photo = (kind: string, ownerId = 'host') =>
    prisma.media.create({
      data: {
        ownerId,
        kind,
        storageKey: 'test-' + Math.random(),
        mimeType: 'image/jpeg',
        size: 10,
        sha256: String(Math.random()),
      },
    });

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-operations-'));
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
    bookings = new BookingsService(
      prisma as any,
      new NotificationsService(prisma as any),
    );
    await prisma.user.create({
      data: {
        id: 'host',
        email: 'host@example.invalid',
        passwordHash: 'test-only',
        firstName: 'Test',
        lastName: 'Host',
        role: 'HOST',
      },
    });
    await prisma.user.create({
      data: {
        id: 'customer',
        email: 'customer@example.invalid',
        passwordHash: 'test-only',
        firstName: '=HYPERLINK("http://example.invalid")',
        lastName: 'Customer',
        isVerified: true,
        dlValidUntil: new Date(Date.now() + 365 * day),
      },
    });
    await prisma.user.create({
      data: {
        id: 'admin',
        email: 'admin@example.invalid',
        passwordHash: 'test-only',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'ADMIN',
      },
    });
    await prisma.vehicle.create({
      data: {
        id: 'car',
        hostId: 'host',
        make: 'Test',
        model: 'Car',
        year: 2024,
        category: 'SUV',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        pricePerDay: 2000,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        availability: 'ACTIVE',
        locationCity: 'Ahmedabad',
        images: '[]',
      },
    });
    for (const kind of ['RC', 'INSURANCE', 'PUC'])
      await prisma.document.create({
        data: {
          userId: 'host',
          vehicleId: 'car',
          kind,
          mediaId: 'evidence-' + kind,
          status: 'APPROVED',
          validUntil: new Date(Date.now() + 365 * day),
        },
      });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (directory && directory.startsWith(join(tmpdir(), 'safar-operations-')))
      rmSync(directory, { recursive: true });
  });

  it('notifies both parties once and does not repeat notifications for idempotent replays', async () => {
    const input = {
      vehicleId: 'car',
      requestKey: 'replay',
      startDate: futureStart.toISOString(),
      endDate: futureEnd.toISOString(),
    };
    const first = await bookings.create('customer', input);
    const replay = await bookings.create('customer', input);
    expect(replay.id).toBe(first.id);
    expect(
      await prisma.notification.count({
        where: {
          bookingId: first.id,
          userId: 'customer',
          type: 'BOOKING_CREATED',
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { bookingId: first.id, userId: 'host', type: 'BOOKING_CREATED' },
      }),
    ).toBe(1);
  });

  it('returns inspection results and refuses photos already used in any inspection photo list', async () => {
    const trip = await booking({
      bookingRef: 'trip',
      status: 'CONFIRMED',
      startDate: new Date(Date.now() - hour),
      endDate: new Date(Date.now() + day),
    });
    const [odometer, selfie, condition] = [
      await photo('ODOMETER'),
      await photo('SELFIE_PICKUP'),
      await photo('INSPECTION_PICKUP'),
    ];
    const pickup = await bookings.inspect(
      { id: 'host', role: 'HOST' },
      trip.id,
      {
        stage: 'PICKUP',
        odometer: 100,
        fuelPercent: 80,
        damageNote: 'No visible damage',
        mediaId: odometer.id,
        mediaIds: [odometer.id, selfie.id, condition.id],
      },
    );
    expect(pickup).toEqual({ message: 'Trip started' });
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: trip.id } }))
        .status,
    ).toBe('ACTIVE');
    const damage = await photo('DAMAGE');
    // The selfie is stored only in the pickup's mediaIds JSON, not its primary mediaId column.
    await expect(
      bookings.inspect({ id: 'host', role: 'HOST' }, trip.id, {
        stage: 'DAMAGE',
        fuelPercent: 70,
        damageNote: 'Scratch',
        mediaId: damage.id,
        mediaIds: [damage.id, selfie.id],
      }),
    ).rejects.toThrow('already used');
    const report = await bookings.inspect(
      { id: 'host', role: 'HOST' },
      trip.id,
      {
        stage: 'DAMAGE',
        fuelPercent: 70,
        damageNote: 'Scratch',
        mediaId: damage.id,
        mediaIds: [damage.id],
      },
    );
    expect(report).toEqual({ message: 'Damage report submitted' });
  });

  it('records agreement acknowledgements against the version snapshotted on the booking', async () => {
    const legacy = await booking({
      bookingRef: 'legacy',
      status: 'CONFIRMED',
      agreementVersion: 'legacy-terms-v1',
    });
    const acknowledged = await bookings.acknowledgeAgreement(
      { id: 'customer', role: 'CUSTOMER' },
      legacy.id,
    );
    expect(acknowledged.version).toBe('legacy-terms-v1');
    const agreement = await bookings.agreement(
      { id: 'customer', role: 'CUSTOMER' },
      legacy.id,
    );
    expect(agreement.agreementVersion).toBe('legacy-terms-v1');
    expect(agreement.acknowledgement?.version).toBe('legacy-terms-v1');
  });

  it('expires only lapsed unpaid holds, once, across concurrent sweeps, and keeps the record', async () => {
    const past = new Date(Date.now() - 5 * 60000);
    const lapsed = await booking({
      bookingRef: 'lapsed',
      status: 'PENDING',
      expiresAt: past,
    });
    const live = await booking({
      bookingRef: 'live',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 10 * 60000),
    });
    const paid = await booking({
      bookingRef: 'paid-pending',
      status: 'PENDING',
      expiresAt: past,
    });
    await prisma.payment.create({
      data: {
        bookingId: paid.id,
        transactionId: 'manual-reconciliation',
        amount: 6000,
        status: 'SUCCESS',
      },
    });
    const confirmed = await booking({
      bookingRef: 'confirmed-old-expiry',
      status: 'CONFIRMED',
      expiresAt: past,
    });
    const active = await booking({
      bookingRef: 'active-old-expiry',
      status: 'ACTIVE',
      expiresAt: past,
    });
    const upcoming = (await new AccountService(prisma as any).dashboard({
      id: 'customer',
      role: 'CUSTOMER',
    })) as any;
    expect(upcoming.upcoming.map((item: any) => item.id)).not.toContain(
      lapsed.id,
    );
    expect(upcoming.upcoming.map((item: any) => item.id)).toContain(live.id);
    // Two instances sharing one database, as with several backend servers.
    const [a, b] = [
      new HoldExpiryService(prisma as any),
      new HoldExpiryService(prisma as any),
    ];
    const results = await Promise.all([a.expireHolds(), b.expireHolds()]);
    const expiredIds = (
      await prisma.auditLog.findMany({ where: { action: HOLD_EXPIRED } })
    ).map((row) => row.targetId);
    expect(results.reduce((sum, r) => sum + r.expired, 0)).toBe(
      expiredIds.length,
    );
    expect(expiredIds).toContain(lapsed.id);
    expect(new Set(expiredIds).size).toBe(expiredIds.length);
    const after = await prisma.booking.findUniqueOrThrow({
      where: { id: lapsed.id },
    });
    expect(after.status).toBe('CANCELLED');
    expect(+after.expiresAt!).toBe(+past);
    for (const [row, status] of [
      [live, 'PENDING'],
      [paid, 'PENDING'],
      [confirmed, 'CONFIRMED'],
      [active, 'ACTIVE'],
    ] as const) {
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: row.id } }))
          .status,
      ).toBe(status);
      expect(expiredIds).not.toContain(row.id);
    }
    expect((await a.expireHolds()).expired).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: HOLD_EXPIRED, targetId: lapsed.id },
      }),
    ).toBe(1);
    const detail = JSON.parse(
      (
        await prisma.auditLog.findFirstOrThrow({
          where: { action: HOLD_EXPIRED, targetId: lapsed.id },
        })
      ).detail,
    );
    expect(detail.reason).toBe(HOLD_EXPIRED);
  });

  it('neutralises spreadsheet formulas in the booking export and audits the download', async () => {
    let body = '';
    const res: any = {
      setHeader: jest.fn(),
      send: (value: string) => {
        body = value;
      },
    };
    await new AdminController(prisma as any, {} as any, {} as any).exportCsv(
      { user: { id: 'admin', role: 'ADMIN' } },
      {},
      res,
    );
    expect(body).toContain(
      `"'=HYPERLINK(""http://example.invalid"") Customer"`,
    );
    expect(body).not.toMatch(/(^|,)"=HYPERLINK/m);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'BOOKINGS_EXPORTED', actorId: 'admin' },
    });
    expect(JSON.parse(audit.detail).rows).toBeGreaterThan(0);
  });

  it('cleans up agreement work folders and hides converter output when PDF generation fails', async () => {
    const trip = await prisma.booking.findFirstOrThrow({
      where: { bookingRef: 'legacy' },
    });
    const before = new Set(
      readdirSync(tmpdir()).filter((name) =>
        name.startsWith('safar-agreement-'),
      ),
    );
    const previous = process.env.AGREEMENT_PYTHON;
    // Node cannot run the Python script, so the populate step fails with stderr that includes local paths.
    process.env.AGREEMENT_PYTHON = process.execPath;
    try {
      const error: any = await bookings
        .agreementPdf({ id: 'customer', role: 'CUSTOMER' }, trip.id)
        .catch((e) => e);
      expect(error.message).toBe(
        'Agreement document conversion failed. Try again later or contact support.',
      );
      expect(error.message).not.toMatch(
        /populate_agreement|SyntaxError|[A-Z]:\\|\//,
      );
    } finally {
      if (previous === undefined) delete process.env.AGREEMENT_PYTHON;
      else process.env.AGREEMENT_PYTHON = previous;
    }
    expect(
      readdirSync(tmpdir()).filter(
        (name) => name.startsWith('safar-agreement-') && !before.has(name),
      ),
    ).toEqual([]);
    expect((bookings as any).pdfJobs).toBe(0);
  });

  it('kills hung converters and limits concurrent PDF jobs', async () => {
    const started = Date.now();
    await expect(
      (bookings as any).runProcess(
        process.execPath,
        ['-e', 'setTimeout(() => {}, 20000)'],
        tmpdir(),
        300,
      ),
    ).rejects.toThrow('conversion failed');
    expect(Date.now() - started).toBeLessThan(5000);
    const trip = await prisma.booking.findFirstOrThrow({
      where: { bookingRef: 'legacy' },
    });
    (bookings as any).pdfJobs = 2;
    try {
      await expect(
        bookings.agreementPdf({ id: 'customer', role: 'CUSTOMER' }, trip.id),
      ).rejects.toThrow('being generated');
    } finally {
      (bookings as any).pdfJobs = 0;
    }
  });
});
