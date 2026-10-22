import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VehiclesService } from './vehicles.service';
import { BookingsService } from '../bookings/bookings.service';
import { AdminController } from '../admin/admin.controller';
import { MediaService } from '../media/media.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { DocumentEvidenceService } from '../kyc/document-evidence.service';
import { PHOTO_KINDS } from '../common/validation';
import { vehicleEligibility, eligibilityMessage } from './vehicle-status';
import { recomputeCustomerVerification } from '../kyc/customer-verification';

type Doc = Parameters<typeof vehicleEligibility>[0]['documents'][number];
type AuditDetail = { to?: string; reason?: string; capacity?: string };

// The response body of the HttpException a call rejects with.
const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected the call to be rejected');
    },
    (error: unknown) => {
      if (error instanceof HttpException) return error.getResponse();
      throw error;
    },
  );
const detail = (row: { detail: string }) =>
  JSON.parse(row.detail) as AuditDetail;

// Phase 6 decisions D1–D4 and the Phase 7 restriction policy: approval and availability are separate; owners pause and
// reactivate their own cars but never approve or lift an administrative restriction; compliance is enforced
// server-side on every public path; deactivation never cancels or changes bookings.
describe('Vehicle approval and availability against an isolated database', () => {
  let directory: string,
    prisma: PrismaClient,
    vehicles: VehiclesService,
    bookings: BookingsService,
    admin: AdminController;
  const previousStorage = process.env.MEDIA_STORAGE;
  const day = 86400000;
  const start = new Date(Date.now() + 20 * day),
    end = new Date(+start + 2 * day);
  const period = { startDate: start.toISOString(), endDate: end.toISOString() };
  const adminReq = { user: { id: 'admin', role: 'ADMIN' } };
  const hostReq = { user: { id: 'host', role: 'HOST' } };
  let key = 0,
    plate = 0;
  const book = (vehicleId: string, dates = period) =>
    bookings.create('customer', {
      vehicleId,
      requestKey: 'k' + ++key,
      ...dates,
    });
  const ids = (list: { id: string }[]) => list.map((v) => v.id);
  const state = (id: string) =>
    prisma.vehicle.findUniqueOrThrow({
      where: { id },
      select: {
        approvalStatus: true,
        availability: true,
        availabilityReason: true,
        status: true,
      },
    });
  const legacyStatus = (approvalStatus: string, availability: string) =>
    approvalStatus === 'APPROVED'
      ? availability === 'ACTIVE'
        ? 'ACTIVE'
        : 'INACTIVE'
      : approvalStatus === 'REJECTED'
        ? 'INACTIVE'
        : 'PENDING_APPROVAL';

  // A car with the given approval/availability, eight photos and genuine documents valid for a year.
  async function car(
    id: string,
    approvalStatus: string,
    availability: string,
    hostId = 'host',
    availabilityReason: string | null = null,
  ) {
    await prisma.vehicle.create({
      data: {
        id,
        hostId,
        make: 'Test',
        model: id,
        year: 2024,
        category: 'SUV',
        transmission: 'Manual',
        fuelType: 'Petrol',
        seats: 5,
        pricePerDay: 1500,
        approvalStatus,
        availability,
        availabilityReason,
        locationCity: 'Vadodara',
        registrationNumber: 'GJ06AP' + String(++plate).padStart(4, '0'),
        images: '[]',
        status: legacyStatus(approvalStatus, availability),
      },
    });
    for (const kind of PHOTO_KINDS)
      await prisma.media.create({
        data: {
          ownerId: hostId,
          vehicleId: id,
          kind,
          storageKey: `${id}-${kind}.jpg`,
          mimeType: 'image/jpeg',
          size: 4,
          sha256: id + kind,
        },
      });
    for (const kind of ['RC', 'INSURANCE', 'PUC'])
      await prisma.document.create({
        data: {
          id: `${id}-${kind}`,
          userId: hostId,
          vehicleId: id,
          kind,
          mediaId: `${id}-${kind}-file`,
          status: 'APPROVED',
          validUntil: new Date(Date.now() + 365 * day),
        },
      });
  }
  const booking = (
    id: string,
    vehicleId: string,
    data: {
      status: 'PENDING' | 'CONFIRMED' | 'ACTIVE';
      expiresAt?: Date;
      startDate?: Date;
      endDate?: Date;
    },
  ) =>
    prisma.booking.create({
      data: {
        id,
        bookingRef: id,
        vehicleId,
        customerId: 'customer',
        totalAmount: 3000,
        startDate: new Date(Date.now() + 40 * day),
        endDate: new Date(Date.now() + 41 * day),
        ...data,
      },
    });
  const flags = (bookingId: string) =>
    prisma.auditLog.findMany({
      where: { action: 'BOOKING_REVIEW_FLAGGED', targetId: bookingId },
      orderBy: { createdAt: 'asc' },
    });
  const availabilityAudit = (vehicleId: string) =>
    prisma.auditLog.findMany({
      where: { action: 'VEHICLE_AVAILABILITY_CHANGED', targetId: vehicleId },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'safar-approval-'));
    process.env.MEDIA_STORAGE = 'memory';
    const filename = join(directory, 'test.db');
    new Database(filename)
      .exec(
        readFileSync(
          join(process.cwd(), 'test/fixtures/sqlite-schema.sql'),
          'utf8',
        ),
      )
      .close();
    prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: 'file:' + filename }),
    });
    const service = prisma as unknown as PrismaService;
    const evidence = {
      available: (doc: { id: string }) =>
        Promise.resolve({ documentId: doc.id, files: [] }),
    } as unknown as DocumentEvidenceService;
    vehicles = new VehiclesService(service);
    bookings = new BookingsService(service);
    admin = new AdminController(service, evidence, vehicles);
    const users: [string, 'HOST' | 'ADMIN' | 'CUSTOMER', boolean][] = [
      ['host', 'HOST', false],
      ['other-host', 'HOST', false],
      ['admin', 'ADMIN', false],
      ['admin-2', 'ADMIN', false],
      ['customer', 'CUSTOMER', true],
      ['kyc-customer', 'CUSTOMER', false],
    ];
    for (const [id, role, verified] of users)
      await prisma.user.create({
        data: {
          id,
          email: id + '@example.invalid',
          passwordHash: 'test-only',
          firstName: 'T',
          lastName: id,
          role,
          isVerified: verified,
          dlValidUntil: verified ? new Date(Date.now() + 365 * day) : null,
        },
      });
    for (const approval of [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
    ])
      for (const availability of ['ACTIVE', 'INACTIVE'])
        await car(
          `m-${approval}-${availability}`.toLowerCase(),
          approval,
          availability,
        );
  });
  afterAll(async () => {
    if (previousStorage === undefined) delete process.env.MEDIA_STORAGE;
    else process.env.MEDIA_STORAGE = previousStorage;
    await prisma?.$disconnect();
    if (directory && directory.startsWith(join(tmpdir(), 'safar-approval-')))
      rmSync(directory, { recursive: true });
  });

  it('only an APPROVED and ACTIVE car is listed, shown, quoted and booked (approval × availability matrix)', async () => {
    const listed = ids(await vehicles.findAll({ ...period, city: 'Vadodara' }));
    expect(listed).toEqual(['m-approved-active']);
    for (const approval of [
      'draft',
      'pending_approval',
      'approved',
      'rejected',
    ])
      for (const availability of ['active', 'inactive']) {
        const id = `m-${approval}-${availability}`;
        if (id === 'm-approved-active') continue;
        await expect(vehicles.findOne(id)).rejects.toThrow('not found');
        await expect(vehicles.quote(id, period)).rejects.toThrow();
        await expect(book(id)).rejects.toThrow('not available');
      }
    expect((await vehicles.quote('m-approved-active', period)).rentalDays).toBe(
      2,
    );
  });

  it('owners pause and reactivate their own approved car, with an audit trail (D1)', async () => {
    await car('owned', 'APPROVED', 'ACTIVE');
    const paused = await vehicles.setAvailability('host', 'owned', {
      availability: 'INACTIVE',
    });
    expect(paused).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'INACTIVE',
      availabilityReason: 'OWNER_PAUSED',
      status: 'INACTIVE',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).not.toContain(
      'owned',
    );
    // An owner cannot choose an administrative reason.
    await vehicles.setAvailability('host', 'owned', {
      availability: 'INACTIVE',
      reason: 'ADMIN_SUSPENDED',
    });
    expect((await state('owned')).availabilityReason).toBe('OWNER_PAUSED');
    const active = await vehicles.setAvailability('host', 'owned', {
      availability: 'ACTIVE',
    });
    expect(active).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'ACTIVE',
      availabilityReason: null,
      status: 'ACTIVE',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).toContain(
      'owned',
    );
    const audit = await availabilityAudit('owned');
    expect(audit.map((a) => [a.actorId, detail(a).to])).toEqual([
      ['host', 'INACTIVE'],
      ['host', 'ACTIVE'],
    ]);
    await expect(
      vehicles.setAvailability('host', 'owned', { availability: 'PAUSED' }),
    ).rejects.toThrow('Availability');
  });

  it("owners cannot change another owner's car, approve, or activate a car that is not approved (D1)", async () => {
    await expect(
      vehicles.setAvailability('other-host', 'owned', {
        availability: 'INACTIVE',
      }),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      vehicles.submit('other-host', 'm-draft-inactive'),
    ).rejects.toThrow('Your vehicle was not found');
    await expect(
      admin.vehicle(hostReq, 'm-pending_approval-inactive', {
        decision: 'APPROVE',
        note: 'self',
      }),
    ).rejects.toThrow('Administrator access required');
    await expect(
      admin.vehicle(hostReq, 'm-pending_approval-inactive', {
        status: 'ACTIVE',
        note: 'self',
      }),
    ).rejects.toThrow('Administrator access required');
    for (const id of [
      'm-pending_approval-inactive',
      'm-draft-inactive',
      'm-rejected-inactive',
    ]) {
      expect(
        await rejection(
          vehicles.setAvailability('host', id, { availability: 'ACTIVE' }),
        ),
      ).toMatchObject({
        reasons: expect.arrayContaining([
          expect.stringMatching(/^APPROVAL_/),
        ]) as unknown,
      });
      // Administrators cannot make a pending or rejected car bookable either.
      await expect(
        vehicles.setAvailability('admin', id, { availability: 'ACTIVE' }),
      ).rejects.toThrow('cannot accept bookings');
      expect((await state(id)).availability).toBe('INACTIVE');
    }
  });

  it('owners cannot lift an administrative suspension or maintenance hold; only another administrator can (Phase 7)', async () => {
    await car('restricted', 'APPROVED', 'ACTIVE');
    await booking('b-restricted', 'restricted', { status: 'CONFIRMED' });
    await prisma.payment.create({
      data: {
        bookingId: 'b-restricted',
        transactionId: 'UTR-RESTRICTED-1',
        amount: 3000,
        status: 'SUCCESS',
      },
    });
    const before = await prisma.booking.findUniqueOrThrow({
      where: { id: 'b-restricted' },
      include: { payment: true },
    });
    await vehicles.setAvailability('admin', 'restricted', {
      availability: 'INACTIVE',
      reason: 'ADMIN_SUSPENDED',
    });
    expect(await state('restricted')).toMatchObject({
      availability: 'INACTIVE',
      availabilityReason: 'ADMIN_SUSPENDED',
    });
    expect(
      await rejection(
        vehicles.setAvailability('host', 'restricted', {
          availability: 'ACTIVE',
        }),
      ),
    ).toMatchObject({ reasons: ['RESTRICTED_ADMIN_SUSPENDED'] });
    // An owner "pause" leaves the administrative reason in place and writes nothing.
    const audits = (await availabilityAudit('restricted')).length;
    await vehicles.setAvailability('host', 'restricted', {
      availability: 'INACTIVE',
    });
    expect((await state('restricted')).availabilityReason).toBe(
      'ADMIN_SUSPENDED',
    );
    expect(await availabilityAudit('restricted')).toHaveLength(audits);
    // Maintenance, set through the legacy admin body, is equally out of the owner's hands.
    await admin.vehicle(adminReq, 'restricted', {
      status: 'MAINTENANCE',
      note: 'Brake service',
    });
    expect(await state('restricted')).toMatchObject({
      availabilityReason: 'MAINTENANCE',
      status: 'MAINTENANCE',
    });
    expect(
      await rejection(
        vehicles.setAvailability('host', 'restricted', {
          availability: 'ACTIVE',
        }),
      ),
    ).toMatchObject({ reasons: ['RESTRICTED_MAINTENANCE'] });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).not.toContain(
      'restricted',
    );
    // An administrator lifts the restriction; the owner may then pause and resume as usual.
    await vehicles.setAvailability('admin', 'restricted', {
      availability: 'ACTIVE',
    });
    await vehicles.setAvailability('host', 'restricted', {
      availability: 'INACTIVE',
    });
    await vehicles.setAvailability('host', 'restricted', {
      availability: 'ACTIVE',
    });
    expect(await state('restricted')).toMatchObject({
      availability: 'ACTIVE',
      availabilityReason: null,
    });
    expect(
      (await availabilityAudit('restricted')).map((a) => [
        detail(a).capacity,
        detail(a).reason ?? null,
      ]),
    ).toEqual([
      ['ADMIN', 'ADMIN_SUSPENDED'],
      ['ADMIN', 'MAINTENANCE'],
      ['ADMIN', null],
      ['OWNER', 'OWNER_PAUSED'],
      ['OWNER', null],
    ]);
    // One flag per reason across every pause and suspension; the booking and payment are untouched.
    expect((await flags('b-restricted')).map((f) => detail(f).reason)).toEqual([
      'VEHICLE_INACTIVE',
    ]);
    expect(
      await prisma.booking.findUniqueOrThrow({
        where: { id: 'b-restricted' },
        include: { payment: true },
      }),
    ).toEqual(before);
  });

  it('a car held for review after the backfill needs an administrator to list it, even once approved (Phase 7)', async () => {
    await car(
      'held',
      'PENDING_APPROVAL',
      'INACTIVE',
      'host',
      'REVIEW_REQUIRED',
    );
    await admin.vehicle(adminReq, 'held', {
      decision: 'APPROVE',
      note: 'Evidence checked',
    });
    expect(
      await rejection(
        vehicles.setAvailability('host', 'held', { availability: 'ACTIVE' }),
      ),
    ).toMatchObject({ reasons: ['RESTRICTED_REVIEW_REQUIRED'] });
    await vehicles.setAvailability('admin', 'held', { availability: 'ACTIVE' });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).toContain('held');
  });

  it('an administrator who owns a car acts as its owner and cannot lift a restriction on it (Phase 7)', async () => {
    await car('admin-car', 'APPROVED', 'ACTIVE', 'admin');
    const paused = await vehicles.setAvailability('admin', 'admin-car', {
      availability: 'INACTIVE',
      reason: 'MAINTENANCE',
    });
    expect(paused.availabilityReason).toBe('OWNER_PAUSED');
    await vehicles.setAvailability('admin', 'admin-car', {
      availability: 'ACTIVE',
    });
    await vehicles.setAvailability('admin-2', 'admin-car', {
      availability: 'INACTIVE',
      reason: 'ADMIN_SUSPENDED',
    });
    await expect(
      vehicles.setAvailability('admin', 'admin-car', {
        availability: 'ACTIVE',
      }),
    ).rejects.toThrow('Only a Safar administrator can lift this restriction');
    await expect(
      admin.vehicle(adminReq, 'admin-car', { status: 'ACTIVE', note: 'mine' }),
    ).rejects.toThrow('Another administrator');
    await vehicles.setAvailability('admin-2', 'admin-car', {
      availability: 'ACTIVE',
    });
    expect((await state('admin-car')).availability).toBe('ACTIVE');
  });

  it('admins approve, reject and revoke separately from availability; self-review is refused (D1/D3)', async () => {
    await car('review', 'PENDING_APPROVAL', 'INACTIVE');
    await car('mine', 'PENDING_APPROVAL', 'INACTIVE', 'admin');
    await expect(
      admin.vehicle(adminReq, 'mine', { decision: 'APPROVE', note: 'own car' }),
    ).rejects.toThrow('Another administrator');
    await expect(
      admin.vehicle(adminReq, 'review', {
        decision: 'REVOKE',
        note: 'not approved yet',
      }),
    ).rejects.toThrow('cannot be revoked');
    // Approval needs current compliance: an expired PUC blocks it and the reasons are shown to the admin.
    await prisma.document.update({
      where: { id: 'review-PUC' },
      data: { validUntil: new Date(Date.now() - day) },
    });
    expect(
      await rejection(
        admin.vehicle(adminReq, 'review', {
          decision: 'APPROVE',
          note: 'expired',
        }),
      ),
    ).toMatchObject({
      message: 'Approve valid RC, insurance and PUC first',
      reasons: ['PUC_EXPIRED'],
    });
    await admin.vehicle(adminReq, 'review', {
      decision: 'REJECT',
      note: 'Renew the PUC certificate',
    });
    expect(
      await prisma.vehicle.findUniqueOrThrow({ where: { id: 'review' } }),
    ).toMatchObject({
      approvalStatus: 'REJECTED',
      availability: 'INACTIVE',
      rejectedReason: 'Renew the PUC certificate',
    });
    // The owner resubmits after renewal; approval then leaves the car inactive until the owner or an admin activates it.
    await prisma.document.update({
      where: { id: 'review-PUC' },
      data: { validUntil: new Date(Date.now() + 365 * day) },
    });
    expect((await vehicles.submit('host', 'review')).approvalStatus).toBe(
      'PENDING_APPROVAL',
    );
    const approved = await admin.vehicle(adminReq, 'review', {
      decision: 'APPROVE',
      note: 'Evidence checked',
    });
    expect(approved).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'INACTIVE',
      approvedById: 'admin',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).not.toContain(
      'review',
    );
    await vehicles.setAvailability('host', 'review', {
      availability: 'ACTIVE',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).toContain(
      'review',
    );
    const actions = (
      await prisma.auditLog.findMany({
        where: { targetId: 'review' },
        orderBy: { createdAt: 'asc' },
      })
    ).map((a) => a.action);
    expect(actions).toEqual([
      'VEHICLE_REJECTED',
      'VEHICLE_SUBMITTED',
      'VEHICLE_APPROVED',
      'VEHICLE_AVAILABILITY_CHANGED',
    ]);
    // Revocation returns the car to review, takes it off the market and applies a review hold (Phase 9 decision D1).
    await admin.vehicle(adminReq, 'review', {
      decision: 'REVOKE',
      note: 'Owner change reported',
    });
    expect(await state('review')).toMatchObject({
      approvalStatus: 'PENDING_APPROVAL',
      availability: 'INACTIVE',
      availabilityReason: 'REVIEW_REQUIRED',
      status: 'PENDING_APPROVAL',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).not.toContain(
      'review',
    );
    const revoked = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'VEHICLE_APPROVAL_REVOKED', targetId: 'review' },
    });
    expect(JSON.parse(revoked.detail) as Record<string, unknown>).toMatchObject(
      {
        previousAvailability: 'ACTIVE',
        previousAvailabilityReason: null,
      },
    );
  });

  it('re-approval after a revocation does not relist the car; only an explicit admin reactivation does (Phase 9 D1)', async () => {
    await car('relist', 'APPROVED', 'ACTIVE');
    await admin.vehicle(adminReq, 'relist', {
      decision: 'REVOKE',
      note: 'Insurance query',
    });
    await admin.vehicle(adminReq, 'relist', {
      decision: 'APPROVE',
      note: 'Query resolved',
    });
    expect(await state('relist')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'INACTIVE',
      availabilityReason: 'REVIEW_REQUIRED',
      status: 'INACTIVE',
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).not.toContain(
      'relist',
    );
    // The owner cannot lift the review hold.
    expect(
      await rejection(
        vehicles.setAvailability('host', 'relist', { availability: 'ACTIVE' }),
      ),
    ).toMatchObject({ reasons: ['RESTRICTED_REVIEW_REQUIRED'] });
    // Admin reactivation re-checks compliance at that moment.
    await prisma.document.update({
      where: { id: 'relist-PUC' },
      data: { validUntil: new Date(Date.now() - day) },
    });
    await expect(
      vehicles.setAvailability('admin', 'relist', { availability: 'ACTIVE' }),
    ).rejects.toThrow('cannot accept bookings');
    await prisma.document.update({
      where: { id: 'relist-PUC' },
      data: { validUntil: new Date(Date.now() + 365 * day) },
    });
    await vehicles.setAvailability('admin', 'relist', {
      availability: 'ACTIVE',
    });
    expect(await state('relist')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'ACTIVE',
      availabilityReason: null,
    });
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).toContain(
      'relist',
    );
  });

  it('a rejected vehicle document revokes approval and applies the same review hold (Phase 9 D1)', async () => {
    await car('doc-revoked', 'APPROVED', 'ACTIVE');
    await prisma.document.update({
      where: { id: 'doc-revoked-RC' },
      data: { status: 'PENDING', mediaId: 'doc-revoked-RC-file' },
    });
    await admin.evidence(adminReq, 'doc-revoked-RC');
    await admin.review(adminReq, 'doc-revoked-RC', {
      status: 'REJECTED',
      note: 'Registration mismatch',
    });
    expect(await state('doc-revoked')).toMatchObject({
      approvalStatus: 'PENDING_APPROVAL',
      availability: 'INACTIVE',
      availabilityReason: 'REVIEW_REQUIRED',
      status: 'PENDING_APPROVAL',
    });
  });

  it('the legacy {status: ACTIVE} request cannot bypass a review hold, authorization or compliance (Phase 11)', async () => {
    const auditCount = (id: string) =>
      prisma.auditLog.count({ where: { targetId: id } });
    // A revoked car is pending under the review hold: the legacy shortcut is refused before anything changes.
    await car('legacy-held', 'APPROVED', 'ACTIVE');
    await admin.vehicle(adminReq, 'legacy-held', {
      decision: 'REVOKE',
      note: 'Paperwork query',
    });
    const held = await state('legacy-held');
    const audits = await auditCount('legacy-held');
    expect(
      await rejection(
        admin.vehicle(adminReq, 'legacy-held', {
          status: 'ACTIVE',
          note: 'shortcut',
        }),
      ),
    ).toMatchObject({ reasons: ['RESTRICTED_REVIEW_REQUIRED'] });
    expect(await state('legacy-held')).toEqual(held);
    expect(await auditCount('legacy-held')).toBe(audits);
    // The same applies to a backfilled demo-style car held for review, and to any administrative restriction.
    await car(
      'legacy-demo',
      'PENDING_APPROVAL',
      'INACTIVE',
      'host',
      'REVIEW_REQUIRED',
    );
    await car(
      'legacy-suspended',
      'PENDING_APPROVAL',
      'INACTIVE',
      'host',
      'ADMIN_SUSPENDED',
    );
    for (const id of ['legacy-demo', 'legacy-suspended']) {
      await expect(
        admin.vehicle(adminReq, id, { status: 'ACTIVE', note: 'shortcut' }),
      ).rejects.toThrow('Approve it first');
      expect((await state(id)).approvalStatus).toBe('PENDING_APPROVAL');
    }
    // Authorization is checked first: hosts and the owning administrator are refused.
    await expect(
      admin.vehicle(hostReq, 'legacy-held', { status: 'ACTIVE', note: 'x' }),
    ).rejects.toThrow('Administrator access required');
    await car('legacy-own', 'APPROVED', 'INACTIVE', 'admin', 'ADMIN_SUSPENDED');
    await expect(
      admin.vehicle(adminReq, 'legacy-own', { status: 'ACTIVE', note: 'x' }),
    ).rejects.toThrow('Another administrator');
    // Approval and reactivation are separate: after APPROVE the hold remains, and the legacy request on the approved
    // car is the explicit reactivation, which re-checks compliance.
    await admin.vehicle(adminReq, 'legacy-held', {
      decision: 'APPROVE',
      note: 'Resolved',
    });
    expect(await state('legacy-held')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'INACTIVE',
      availabilityReason: 'REVIEW_REQUIRED',
    });
    await prisma.document.update({
      where: { id: 'legacy-held-INSURANCE' },
      data: { validUntil: new Date(Date.now() - day) },
    });
    await expect(
      admin.vehicle(adminReq, 'legacy-held', { status: 'ACTIVE', note: 'x' }),
    ).rejects.toThrow('cannot accept bookings');
    expect((await state('legacy-held')).availability).toBe('INACTIVE');
    await prisma.document.update({
      where: { id: 'legacy-held-INSURANCE' },
      data: { validUntil: new Date(Date.now() + 365 * day) },
    });
    await admin.vehicle(adminReq, 'legacy-held', {
      status: 'ACTIVE',
      note: 'Relist after review',
    });
    expect(await state('legacy-held')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'ACTIVE',
      availabilityReason: null,
    });
    // Unchanged legacy behaviour for a pending car with no restriction: approve and list, through the same checks.
    await car('legacy-new', 'PENDING_APPROVAL', 'INACTIVE');
    await admin.vehicle(adminReq, 'legacy-new', {
      status: 'ACTIVE',
      note: 'Evidence checked',
    });
    expect(await state('legacy-new')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'ACTIVE',
    });
  });

  it('every document state other than approved, evidenced, genuine and in date blocks eligibility (D3)', () => {
    const doc = (over: Partial<Doc> = {}): Doc => ({
      kind: 'RC',
      status: 'APPROVED',
      mediaId: 'file',
      source: 'UPLOAD',
      validUntil: new Date(Date.now() + 365 * day),
      ...over,
    });
    const vehicle = (rc: Doc[]) => ({
      approvalStatus: 'APPROVED',
      availability: 'ACTIVE',
      documents: [...rc, doc({ kind: 'INSURANCE' }), doc({ kind: 'PUC' })],
    });
    const cases: [string, Doc[], string[]][] = [
      ['valid', [doc()], []],
      ['missing', [], ['RC_MISSING']],
      ['pending', [doc({ status: 'PENDING' })], ['RC_PENDING_REVIEW']],
      ['rejected', [doc({ status: 'REJECTED' })], ['RC_REJECTED']],
      [
        'expired',
        [doc({ validUntil: new Date(Date.now() - day) })],
        ['RC_EXPIRED'],
      ],
      ['expiry missing', [doc({ validUntil: null })], ['RC_EXPIRY_MISSING']],
      ['no evidence file', [doc({ mediaId: null })], ['RC_UNVERIFIED']],
      ['demo record', [doc({ source: 'DEMO_SEED' })], ['RC_UNVERIFIED']],
      [
        'provider test record',
        [doc({ source: 'DIGILOCKER_TEST' })],
        ['RC_UNVERIFIED'],
      ],
      [
        'expires during the trip',
        [doc({ validUntil: new Date(+start + day) })],
        ['RC_EXPIRES_BEFORE_RETURN'],
      ],
    ];
    for (const [name, rc, reasons] of cases)
      expect([name, vehicleEligibility(vehicle(rc), end).reasons]).toEqual([
        name,
        reasons,
      ]);
    // Users get a safe message; detailed reasons stay with owners and admins.
    expect(eligibilityMessage(['RC_UNVERIFIED'])).not.toMatch(
      /RC|DEMO|evidence/,
    );
    expect(eligibilityMessage(['RC_EXPIRES_BEFORE_RETURN'])).toMatch(
      /return date/,
    );
  });

  it('non-compliant documents block listing, detail, quote, booking and payment on the server (D3)', async () => {
    await car('lapsing', 'APPROVED', 'ACTIVE');
    const hold = await book('lapsing');
    expect(hold.status).toBe('PENDING');
    await prisma.document.update({
      where: { id: 'lapsing-INSURANCE' },
      data: { validUntil: new Date(+start + day) },
    });
    // A later period that does not overlap the hold, still ending after the insurance lapses.
    const later = {
      startDate: new Date(+start + 5 * day).toISOString(),
      endDate: new Date(+start + 7 * day).toISOString(),
    };
    expect(
      ids(await vehicles.findAll({ ...later, city: 'Vadodara' })),
    ).not.toContain('lapsing');
    // Undated searches check compliance through today, so the car is still listed until the insurance lapses.
    expect(ids(await vehicles.findAll({ city: 'Vadodara' }))).toContain(
      'lapsing',
    );
    await expect(vehicles.quote('lapsing', later)).rejects.toThrow(
      'not valid through your return date',
    );
    await expect(book('lapsing', later)).rejects.toThrow('return date');
    await expect(
      admin.payment(adminReq, hold.id, {
        reference: 'UTR-LAPSE-1',
        amount: Number(hold.totalAmount),
        received: true,
      }),
    ).rejects.toThrow('vehicle eligibility changed');
    // Unevidenced (demo-style) documents block even when the expiry date is fine.
    await prisma.document.update({
      where: { id: 'lapsing-INSURANCE' },
      data: { validUntil: new Date(Date.now() + 365 * day), mediaId: null },
    });
    await expect(vehicles.findOne('lapsing')).rejects.toThrow('not found');
    await expect(book('lapsing', later)).rejects.toThrow(
      'until its documents are verified',
    );
    expect(
      (await vehicles.mine('host')).find((v) => v.id === 'lapsing')?.eligibility
        .reasons,
    ).toEqual(['INSURANCE_UNVERIFIED']);
  });

  it('deactivation keeps every booking and payment, flags upcoming bookings once, and reactivation re-checks compliance (D4)', async () => {
    await car('fleet', 'APPROVED', 'ACTIVE');
    const confirmed = await booking('b-confirmed', 'fleet', {
      status: 'CONFIRMED',
    });
    await prisma.payment.create({
      data: {
        bookingId: 'b-confirmed',
        transactionId: 'UTR-FLEET-1',
        amount: 3000,
        status: 'SUCCESS',
      },
    });
    const hold = await booking('b-hold', 'fleet', {
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 10 * 60000),
    });
    const trip = await booking('b-trip', 'fleet', {
      status: 'ACTIVE',
      startDate: new Date(Date.now() - day),
      endDate: new Date(Date.now() + day),
    });
    const expired = await booking('b-expired-hold', 'fleet', {
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60000),
    });
    const fleetBookings = () =>
      prisma.booking.findMany({
        where: { vehicleId: 'fleet' },
        include: { payment: true },
        orderBy: { id: 'asc' },
      });
    const before = await fleetBookings();

    const paused = await vehicles.setAvailability('host', 'fleet', {
      availability: 'INACTIVE',
    });
    expect(paused.flaggedBookings).toBe(2);
    expect(await fleetBookings()).toEqual(before);
    expect((await flags(confirmed.id)).map((f) => detail(f).reason)).toEqual([
      'VEHICLE_INACTIVE',
    ]);
    expect(await flags(hold.id)).toHaveLength(1);
    expect(await flags(trip.id)).toHaveLength(0);
    expect(await flags(expired.id)).toHaveLength(0);

    // Repeated pauses, including after a reactivation, never duplicate a flag; admin maintenance is the same reason.
    await vehicles.setAvailability('host', 'fleet', {
      availability: 'INACTIVE',
    });
    await vehicles.setAvailability('host', 'fleet', { availability: 'ACTIVE' });
    await vehicles.setAvailability('host', 'fleet', {
      availability: 'INACTIVE',
    });
    expect(await flags(confirmed.id)).toHaveLength(1);
    await admin.vehicle(adminReq, 'fleet', {
      status: 'MAINTENANCE',
      note: 'Service due',
    });
    expect(await state('fleet')).toMatchObject({
      approvalStatus: 'APPROVED',
      availability: 'INACTIVE',
      availabilityReason: 'MAINTENANCE',
      status: 'MAINTENANCE',
    });
    expect(await flags(confirmed.id)).toHaveLength(1);
    await admin.vehicle(adminReq, 'fleet', {
      decision: 'REVOKE',
      note: 'Paperwork query',
    });
    expect((await flags(confirmed.id)).map((f) => detail(f).reason)).toEqual([
      'VEHICLE_INACTIVE',
      'APPROVAL_REVOKED',
    ]);
    expect(await fleetBookings()).toEqual(before);

    // Admins see the flagged upcoming bookings once each in the overview.
    const overview = await admin.overview(adminReq, {});
    expect(
      overview.reviewFlags.filter((f) => f.bookingId === 'b-confirmed'),
    ).toHaveLength(1);

    // Reactivation cannot bypass the maintenance hold, approval or compliance.
    await expect(
      vehicles.setAvailability('host', 'fleet', { availability: 'ACTIVE' }),
    ).rejects.toThrow('Only a Safar administrator can lift this restriction');
    await expect(
      vehicles.setAvailability('admin', 'fleet', { availability: 'ACTIVE' }),
    ).rejects.toThrow('cannot accept bookings');
    await prisma.document.update({
      where: { id: 'fleet-RC' },
      data: { validUntil: new Date(Date.now() - day) },
    });
    await expect(
      admin.vehicle(adminReq, 'fleet', {
        decision: 'APPROVE',
        note: 'Looks fine',
      }),
    ).rejects.toThrow('Approve valid RC');
    expect((await state('fleet')).approvalStatus).toBe('PENDING_APPROVAL');
  });

  it('only APPROVED and ACTIVE cars show photos publicly', async () => {
    const media = new MediaService(prisma as unknown as PrismaService);
    const photo = async (vehicleId: string) =>
      (await prisma.media.findFirstOrThrow({ where: { vehicleId } })).id;
    for (const id of [
      'm-approved-inactive',
      'm-pending_approval-active',
      'm-rejected-active',
    ])
      await expect(media.read(await photo(id))).rejects.toThrow(
        'Image access denied',
      );
  });

  it('demo and provider-test KYC records never verify a customer; genuine approved records do', async () => {
    const valid = new Date(Date.now() + 365 * day);
    await prisma.document.create({
      data: {
        id: 'kyc-dl',
        userId: 'kyc-customer',
        kind: 'DL',
        status: 'APPROVED',
        source: 'DEMO_SEED',
        validUntil: valid,
      },
    });
    await prisma.document.create({
      data: {
        id: 'kyc-aadhaar',
        userId: 'kyc-customer',
        kind: 'AADHAAR',
        status: 'APPROVED',
        source: 'DIGILOCKER_TEST',
      },
    });
    expect(await recomputeCustomerVerification(prisma, 'kyc-customer')).toEqual(
      { isVerified: false, dlValidUntil: null },
    );
    await admin.evidence(adminReq, 'kyc-dl');
    await expect(
      admin.review(adminReq, 'kyc-dl', {
        status: 'APPROVED',
        note: 'demo',
        identityChecked: true,
        validUntil: '2031-01-01',
      }),
    ).rejects.toThrow('cannot grant rental eligibility');
    await prisma.document.update({
      where: { id: 'kyc-dl' },
      data: { source: 'UPLOAD', mediaId: 'dl-file' },
    });
    await prisma.document.update({
      where: { id: 'kyc-aadhaar' },
      data: { source: 'DIGILOCKER_LIVE' },
    });
    expect(await recomputeCustomerVerification(prisma, 'kyc-customer')).toEqual(
      { isVerified: true, dlValidUntil: valid },
    );
  });
});
