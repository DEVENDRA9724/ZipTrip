// Checks for the shortcuts that came with the origin/main merge: they keep working where intended (local development,
// explicit admin review) but can no longer verify users, approve documents or confirm bookings on their own.
import { ForbiddenException } from '@nestjs/common';
import { isLocalDevelopment } from './environment';
import { BookingsService } from '../bookings/bookings.service';
import { AdminController } from '../admin/admin.controller';
import { KycController } from '../kyc/kyc.controller';
import type { PrismaService } from '../prisma/prisma.service';

// Controllers built without Nest's injector; the test supplies the database.
// Controllers built without Nest's injector; the test supplies the database through Object.assign.

describe('local development shortcuts', () => {
  const previous = process.env.NODE_ENV;
  afterEach(() => {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });

  it('are on only for an explicit development or test environment', () => {
    expect(isLocalDevelopment({ NODE_ENV: 'development' })).toBe(true);
    expect(isLocalDevelopment({ NODE_ENV: 'test' })).toBe(true);
    expect(isLocalDevelopment({ NODE_ENV: 'production' })).toBe(false);
    expect(isLocalDevelopment({})).toBe(false);
  });

  it('refuse to confirm a booking without the payment gateway outside local development', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new BookingsService(prisma as unknown as PrismaService);
    for (const env of ['production', undefined]) {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
      await expect(
        service.pay('customer', 'booking', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('admin KYC actions', () => {
  const adminReq = { user: { id: 'admin', role: 'ADMIN' } };

  it('quick review goes through the full document review', async () => {
    const controller = Object.create(
      AdminController.prototype,
    ) as AdminController;
    const review = jest
      .spyOn(controller, 'review')
      .mockResolvedValue({ id: 'doc' } as Awaited<
        ReturnType<AdminController['review']>
      >);
    await controller.quickReviewDocument(adminReq, 'doc', {
      status: 'APPROVED',
      validUntil: '2030-01-01',
      identityChecked: true,
    });
    expect(review).toHaveBeenCalledWith(
      adminReq,
      'doc',
      expect.objectContaining({
        status: 'APPROVED',
        validUntil: '2030-01-01',
        identityChecked: true,
      }),
    );
  });

  it('verify-kyc never approves documents or grants verification without approved records', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u',
          isVerified: false,
          dlValidUntil: null,
        }),
        update: jest.fn(),
      },
      userProfile: { updateMany: jest.fn() },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const controller = Object.create(
      AdminController.prototype,
    ) as AdminController;
    Object.assign(controller, {
      prisma: {
        $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      },
    });
    const result = await controller.adminVerifyUserKyc(adminReq, 'u', {
      verified: true,
    });
    expect(result).toEqual(
      expect.objectContaining({ success: false, isVerified: false }),
    );
    expect(tx.document.updateMany).not.toHaveBeenCalled();
    expect(tx.document.update).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isVerified: false, dlValidUntil: null },
      }),
    );

    const revoked = await controller.adminVerifyUserKyc(adminReq, 'u', {
      verified: false,
    });
    expect(revoked).toEqual({ success: true, isVerified: false });
    expect(tx.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ action: 'ADMIN_KYC_REVOKED' }),
    });
  });
});

describe('selfie e-KYC submission', () => {
  it('queues pending documents for review and never verifies the user', async () => {
    const created: { kind: string; status: string }[] = [];
    const tx = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'u', firstName: 'A', lastName: 'B' }),
        update: jest.fn(),
      },
      userProfile: { upsert: jest.fn().mockResolvedValue({}) },
      document: {
        create: jest.fn(
          ({ data }: { data: { kind: string; status: string } }) => {
            created.push(data);
            return Promise.resolve({ id: 'doc-' + created.length });
          },
        ),
      },
      auditLog: { create: jest.fn() },
    };
    const controller = Object.create(KycController.prototype) as KycController;
    Object.assign(controller, {
      prisma: {
        media: {
          findFirst: jest.fn(
            ({ where }: { where: { id: string; kind?: string } }) =>
              Promise.resolve(
                where.id === 'selfie' || where.kind === 'DL'
                  ? { id: where.id, sha256: 'ff', size: 50000 }
                  : null,
              ),
          ),
        },
        document: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      },
    });
    const result = await controller.verifyIdentityAndFaceMatch(
      { user: { id: 'u' } },
      {
        consent: true,
        aadhaarNumber: '123412341234',
        dlNumber: 'GJ0120190012345',
        dlExpiryDate: '2031-01-01',
        selfieMediaId: 'selfie',
        dlMediaId: 'dl-image',
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        autoVerified: false,
        faceMatchScore: null,
        status: 'PENDING',
      }),
    );
    expect(created.map((d) => [d.kind, d.status])).toEqual([
      ['AADHAAR', 'PENDING'],
      ['DL', 'PENDING'],
    ]);
    expect(tx.user.update).not.toHaveBeenCalled();
    // Another user's (or a non-DL) upload cannot be attached as document evidence.
    await expect(
      controller.verifyIdentityAndFaceMatch(
        { user: { id: 'u' } },
        {
          consent: true,
          aadhaarNumber: '123412341234',
          dlNumber: 'GJ0120190012345',
          dlExpiryDate: '2031-01-01',
          selfieMediaId: 'selfie',
          aadhaarMediaId: 'not-mine',
        },
      ),
    ).rejects.toThrow('Upload the document image again');
  });
});
