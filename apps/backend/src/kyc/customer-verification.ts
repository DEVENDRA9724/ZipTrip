import type { Prisma, PrismaClient } from '@prisma/client';
import { unverifiedDocumentSources } from '../vehicles/vehicle-status';

// Recomputes a customer's booking eligibility from approved personal documents: an approved, unexpired DL and an approved
// Aadhaar. Provider test data never counts; demo records count only in local demo mode (DEMO_VERIFICATION).
export async function recomputeCustomerVerification(
  tx: Prisma.TransactionClient | PrismaClient,
  userId: string,
  now: Date = new Date(),
) {
  const approved = await tx.document.findMany({
    where: {
      userId,
      vehicleId: null,
      status: 'APPROVED',
      source: { notIn: unverifiedDocumentSources() },
    },
  });
  const dl = approved
    .filter((d) => d.kind === 'DL' && d.validUntil && d.validUntil > now)
    .sort((a, b) => Number(b.validUntil) - Number(a.validUntil))[0];
  const isVerified = Boolean(dl && approved.some((d) => d.kind === 'AADHAAR'));
  const dlValidUntil = dl?.validUntil || null;
  await tx.user.update({
    where: { id: userId },
    data: { isVerified, dlValidUntil },
  });
  return { isVerified, dlValidUntil };
}
