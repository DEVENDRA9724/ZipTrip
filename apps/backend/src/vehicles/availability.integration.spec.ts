import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VehiclesService } from './vehicles.service';
import { BookingsService } from '../bookings/bookings.service';
import { AdminController } from '../admin/admin.controller';
import { PHOTO_KINDS } from '../common/validation';
const Database = require('better-sqlite3');

describe('Availability against an isolated database', () => {
  let directory: string, prisma: PrismaClient, service: VehiclesService;
  const start = new Date(Date.now() + 10 * 86400000);
  const end = new Date(+start + 2 * 86400000);
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-availability-'));
    const filename = join(directory, 'test.db');
    const db = new Database(filename);
    db.exec(readFileSync(join(process.cwd(), 'test/fixtures/sqlite-schema.sql'), 'utf8'));
    db.close();
    prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + filename }) });
    service = new VehiclesService(prisma as any);
    await prisma.user.create({ data: { id: 'host', email: 'test@example.invalid', passwordHash: 'test-only', firstName: 'Test', lastName: 'Host', role: 'HOST' } });
    for (const id of ['free', 'confirmed', 'active', 'held', 'expired', 'cancelled', 'boundary', 'invalid-docs']) {
      await prisma.vehicle.create({ data: { id, hostId: 'host', make: 'Test', model: id, year: 2024, category: 'SUV', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 2000, status: 'ACTIVE', locationCity: 'Ahmedabad', images: '[]' } });
      for (const kind of ['RC', 'INSURANCE', 'PUC']) await prisma.document.create({ data: { userId: 'host', vehicleId: id, kind, status: 'APPROVED', validUntil: new Date(+end + (id === 'invalid-docs' ? -1 : 86400000)) } });
    }
    for (const [id, status] of [['confirmed', 'CONFIRMED'], ['active', 'ACTIVE'], ['held', 'PENDING'], ['expired', 'PENDING'], ['cancelled', 'CANCELLED'], ['boundary', 'CONFIRMED']] as const) {
      await prisma.booking.create({ data: { bookingRef: id, vehicleId: id, customerId: 'host', startDate: id === 'boundary' ? end : start, endDate: new Date(+end + 86400000), status, totalAmount: 4000, expiresAt: new Date(Date.now() + (id === 'expired' ? -60000 : 600000)) } });
    }
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (directory && directory.startsWith(join(tmpdir(), 'safar-availability-'))) rmSync(directory, { recursive: true });
  });
  it('hides overlaps and expired compliance, releases expired/cancelled holds, and allows adjacent trips', async () => {
    const cars = await service.findAll({ startDate: start.toISOString(), endDate: end.toISOString(), city: 'Ahmedabad' });
    expect(cars.map(car => car.id).sort()).toEqual(['boundary', 'cancelled', 'expired', 'free']);
  });
  it('blocks host dates across search, quotes and checkout, then restores them when released', async () => {
    await prisma.user.create({ data: { id: 'customer', email: 'customer@example.invalid', passwordHash: 'test-only', firstName: 'Test', lastName: 'Customer', isVerified: true, dlValidUntil: new Date(+end + 86400000) } });
    const period = { startDate: start.toISOString(), endDate: end.toISOString() };
    await expect(service.block('customer', 'free', { ...period, reason: 'Not my car' })).rejects.toThrow('Your vehicle');
    const block = await service.block('host', 'free', { ...period, reason: 'Scheduled maintenance' });
    expect((await service.findAll(period)).some(car => car.id === 'free')).toBe(false);
    await expect(service.quote('free', period)).rejects.toThrow('unavailable');
    const bookings = new BookingsService(prisma as any);
    await expect(bookings.create('customer', { ...period, vehicleId: 'free', requestKey: 'blocked' })).rejects.toThrow('host has blocked');
    await expect(service.releaseBlock('customer', 'free', block.id)).rejects.toThrow('Your vehicle');
    await service.releaseBlock('host', 'free', block.id);
    const quote = await service.quote('free', period);
    expect(quote.totalAmount).toBe(6000);
    expect(quote.includedKilometres).toBe(600);
    await expect(bookings.create('customer', { ...period, vehicleId: 'free', requestKey: 'price-mismatch', expectedTotal: 1 })).rejects.toThrow('price changed');
    const reservation = await bookings.create('customer', { ...period, vehicleId: 'free', requestKey: 'correct', expectedTotal: quote.totalAmount });
    expect(Number(reservation.securityDeposit)).toBe(2000);
    expect(reservation.includedKilometres).toBe(600);
    expect(Number(reservation.totalAmount)).toBe(quote.totalAmount);
    await expect(service.block('host', 'free', { ...period, reason: 'Must not displace customer' })).rejects.toThrow('existing booking');
    await expect(bookings.create('customer', { ...period, vehicleId: 'free', requestKey: 'duplicate' })).rejects.toThrow('already reserved');
    const repeated = await bookings.create('customer', { ...period, vehicleId: 'free', requestKey: 'correct' });
    expect(repeated.id).toBe(reservation.id);
  });
  it('accepts Compact SUV submissions and rejects duplicate pictures and registrations', async () => {
    const mediaIds: string[] = [];
    for (const kind of PHOTO_KINDS) {
      const photo = await prisma.media.create({ data: { ownerId: 'host', kind, storageKey: 'test-' + kind, mimeType: 'image/jpeg', size: 50, sha256: kind } });
      mediaIds.push(photo.id);
    }
    const input = { mediaIds, registrationNumber: 'GJ01TEST12', make: 'Test', model: 'Compact', year: 2024, category: 'Compact SUV', transmission: 'Manual', fuelType: 'Petrol', seats: 5, pricePerDay: 2000, odometer: 100, locationCity: 'Ahmedabad' };
    await prisma.media.update({ where: { id: mediaIds[1] }, data: { sha256: PHOTO_KINDS[0] } });
    await expect(service.create('host', input)).rejects.toThrow('different photo');
    await prisma.media.update({ where: { id: mediaIds[1] }, data: { sha256: PHOTO_KINDS[1] } });
    const car = await service.create('host', input);
    expect(car.category).toBe('Compact SUV');
    expect(car.status).toBe('PENDING_APPROVAL');
    await expect(service.create('host', input)).rejects.toThrow('already listed');
  });
  it('audits admin prices and blocks, protects existing quotes, and restricts checkout hold changes', async () => {
    await prisma.user.create({ data: { id: 'admin', email: 'admin@example.invalid', passwordHash: 'test-only', firstName: 'Test', lastName: 'Admin', role: 'ADMIN' } });
    const controller = new AdminController(prisma as any, {} as any);
    const req = { user: { id: 'admin', role: 'ADMIN' } };
    await expect(controller.pricing({ user: { id: 'host', role: 'HOST' } }, 'free', { pricePerDay: 2500, expectedRate: 2000, reason: 'Test' })).rejects.toThrow('Administrator');
    const previous = await prisma.booking.findFirstOrThrow({ where: { vehicleId: 'free' } });
    await controller.pricing(req, 'free', { pricePerDay: 2500, expectedRate: 2000, reason: 'Seasonal rate' });
    expect(Number((await prisma.booking.findUniqueOrThrow({ where: { id: previous.id } })).totalAmount)).toBe(Number(previous.totalAmount));
    await expect(controller.pricing(req, 'free', { pricePerDay: 2600, expectedRate: 2000, reason: 'Stale edit' })).rejects.toThrow('changed');
    const period = { startDate: new Date(+end + 86400000).toISOString(), endDate: new Date(+end + 2 * 86400000).toISOString(), reason: 'Admin maintenance' };
    const block = await service.block('admin', 'free', period);
    expect((await service.schedule('admin', 'free')).blocks.some(b => b.id === block.id)).toBe(true);
    await service.releaseBlock('admin', 'free', block.id);
    expect(await prisma.auditLog.count({ where: { actorId: 'admin', targetId: block.id } })).toBe(2);
    await controller.hold(req, previous.id, { action: 'EXTEND', minutes: 90, reason: 'Awaiting transfer' });
    const extended = await prisma.booking.findUniqueOrThrow({ where: { id: previous.id } });
    expect(+extended.expiresAt!).toBeGreaterThan(+previous.expiresAt!);
    const expired = await prisma.booking.findUniqueOrThrow({ where: { bookingRef: 'expired' } });
    await expect(controller.hold(req, expired.id, { action: 'EXTEND', minutes: 90, reason: 'Expired' })).rejects.toThrow('live unpaid');
    const confirmed = await prisma.booking.findUniqueOrThrow({ where: { bookingRef: 'confirmed' } });
    await expect(controller.hold(req, confirmed.id, { action: 'RELEASE', reason: 'Not a checkout hold' })).rejects.toThrow('live unpaid');
    await controller.hold(req, previous.id, { action: 'RELEASE', reason: 'Customer abandoned checkout' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: previous.id } })).status).toBe('CANCELLED');
    await expect(controller.hold(req, previous.id, { action: 'EXTEND', minutes: 90, reason: 'No revival' })).rejects.toThrow('live unpaid');
  });
});
