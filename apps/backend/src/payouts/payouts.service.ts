import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  admin,
  choice,
  fleetManager,
  number,
  text,
} from '../common/validation';

const ACCOUNT_NUMBER = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
] as const;
type PayoutStatus = (typeof STATUSES)[number];
// PAID and CANCELLED are final. FAILED may be retried (back to PENDING) or abandoned. A payout already sent for processing
// cannot be cancelled here; record PAID or FAILED once the bank result is known.
export const PAYOUT_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> =
  {
    PENDING: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED'],
    PROCESSING: ['PAID', 'FAILED'],
    FAILED: ['PENDING', 'CANCELLED'],
    PAID: [],
    CANCELLED: [],
  };
const FINAL: readonly string[] = ['PAID', 'FAILED', 'CANCELLED'];
const DUPLICATE_WINDOW_MS = 10 * 60000;

// Destination snapshot states (Payout.destinationState).
export const DESTINATION = {
  CAPTURED: 'CAPTURED',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  LEGACY_UNVERIFIED: 'LEGACY_UNVERIFIED',
} as const;
// Ciphertext and fingerprints never leave the service in ordinary responses.
const ACCOUNT_SECRET_FIELDS = new Set([
  'encryptedAccountNumber',
  'fingerprint',
]);
function withoutAccountSecrets<T extends object>(account: T) {
  return Object.fromEntries(
    Object.entries(account).filter(([key]) => !ACCOUNT_SECRET_FIELDS.has(key)),
  ) as Omit<T, 'encryptedAccountNumber' | 'fingerprint'>;
}
const PAYOUT_OMIT = {
  destinationEncryptedAccountNumber: true,
  destinationFingerprint: true,
} as const;

type Account = {
  id: string;
  userId: string;
  accountHolderName: string;
  bankName: string;
  accountNumberLast4: string;
  ifscCode: string;
  encryptedAccountNumber: string;
  status: string;
  revision: number;
  fingerprint: string | null;
  changedById: string | null;
  verifiedRevision: number | null;
};

function periodDate(
  value: unknown,
  field: string,
  endOfDay = false,
): Date | null {
  if (value == null || value === '') return null;
  const raw = text(value, field, 40);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(raw + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'))
    : new Date(raw);
  if (
    !/^\d{4}-\d{2}-\d{2}($|T)/.test(raw) ||
    !Number.isFinite(+date) ||
    date.getUTCFullYear() < 2020 ||
    date.getUTCFullYear() > 2100
  )
    throw new BadRequestException(
      `Enter a valid ${field.toLowerCase()} (YYYY-MM-DD)`,
    );
  return date;
}

// A verified destination is one approved by a second person for exactly the account revision that is current now.
export function destinationVerified(
  account: Pick<
    Account,
    'status' | 'revision' | 'verifiedRevision' | 'fingerprint'
  >,
) {
  return (
    account.status === 'VERIFIED' &&
    account.verifiedRevision === account.revision &&
    Boolean(account.fingerprint)
  );
}

// Thrown inside a transaction when the destination policy blocks a payout; the audit row is written after rollback.
class DestinationBlocked extends ConflictException {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(user: { id: string; role: string }) {
    fleetManager(user);
    const account = await this.prisma.payoutAccount.findUnique({
      where: { userId: user.id },
      include: {
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          omit: PAYOUT_OMIT,
        },
      },
    });
    if (!account) return null;
    return {
      ...withoutAccountSecrets(account),
      verificationCurrent: destinationVerified(account),
    };
  }

  // Hosts (and fleet admins) manage only their own account: the target is always the signed-in user, never a body field.
  async saveAccount(user: { id: string; role: string }, body: any) {
    fleetManager(user);
    const accountHolderName = text(
      body.accountHolderName,
      'Account holder name',
      120,
    ).replace(/\s+/g, ' ');
    const bankName = text(body.bankName, 'Bank name', 120).replace(/\s+/g, ' ');
    const accountNumber = text(
      body.accountNumber,
      'Account number',
      18,
    ).replace(/\s/g, '');
    const ifscCode = text(body.ifscCode, 'IFSC code', 11).toUpperCase();
    if (!ACCOUNT_NUMBER.test(accountNumber))
      throw new BadRequestException('Enter a valid bank account number');
    if (!IFSC.test(ifscCode))
      throw new BadRequestException('Enter a valid IFSC code');
    const fingerprint = this.fingerprint({
      accountHolderName,
      bankName,
      ifscCode,
      accountNumber,
    });
    return this.prisma.$transaction(async (tx) => {
      const current = (await tx.payoutAccount.findUnique({
        where: { userId: user.id },
      })) as Account | null;
      const masked = {
        bankName,
        accountNumberLast4: accountNumber.slice(-4),
        ifscCode,
      };
      if (current) {
        const currentFingerprint =
          current.fingerprint ?? this.legacyFingerprint(current);
        if (currentFingerprint === fingerprint) {
          // Identical details: verification is kept. Legacy rows get their fingerprint recorded without other changes.
          if (!current.fingerprint)
            await tx.payoutAccount.updateMany({
              where: { id: current.id, revision: current.revision },
              data: { fingerprint },
            });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'PAYOUT_ACCOUNT_RESUBMITTED_UNCHANGED',
              targetId: current.id,
              detail: JSON.stringify({ revision: current.revision, ...masked }),
            },
          });
          return this.publicAccount(tx, current.id);
        }
        const revision = current.revision + 1;
        // Guarded on the revision so a concurrent change or verification cannot be overwritten silently.
        const changed = await tx.payoutAccount.updateMany({
          where: { id: current.id, revision: current.revision },
          data: {
            accountHolderName,
            bankName,
            ifscCode,
            accountNumberLast4: masked.accountNumberLast4,
            encryptedAccountNumber: this.encrypt(accountNumber),
            fingerprint,
            status: 'PENDING',
            revision,
            changedById: user.id,
            changedAt: new Date(),
            reviewedById: null,
            reviewedAt: null,
            verifiedRevision: null,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Bank details were changed by another request. Refresh and try again.',
          );
        const blockedPayouts = await tx.payout.count({
          where: {
            accountId: current.id,
            status: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'PAYOUT_ACCOUNT_CHANGE_INITIATED',
            targetId: current.id,
            detail: JSON.stringify({
              revision,
              ...masked,
              previous: {
                revision: current.revision,
                accountNumberLast4: current.accountNumberLast4,
                ifscCode: current.ifscCode,
                status: current.status,
              },
              openPayouts: blockedPayouts,
            }),
          },
        });
        if (current.status === 'VERIFIED')
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'PAYOUT_ACCOUNT_VERIFICATION_INVALIDATED',
              targetId: current.id,
              detail: JSON.stringify({
                previousRevision: current.revision,
                previouslyVerifiedRevision: current.verifiedRevision,
                newRevision: revision,
                reason: 'BANK_DETAILS_CHANGED',
              }),
            },
          });
        return this.publicAccount(tx, current.id);
      }
      const created = await tx.payoutAccount.create({
        data: {
          userId: user.id,
          accountHolderName,
          bankName,
          ifscCode,
          accountNumberLast4: masked.accountNumberLast4,
          encryptedAccountNumber: this.encrypt(accountNumber),
          fingerprint,
          status: 'PENDING',
          revision: 1,
          changedById: user.id,
          changedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PAYOUT_ACCOUNT_CHANGE_INITIATED',
          targetId: created.id,
          detail: JSON.stringify({
            revision: 1,
            ...masked,
            previous: null,
            openPayouts: 0,
          }),
        },
      });
      return this.publicAccount(tx, created.id);
    });
  }

  async list(user: { id: string; role: string }) {
    if (user.role === 'ADMIN') {
      const payouts = await this.prisma.payout.findMany({
        omit: PAYOUT_OMIT,
        include: {
          account: {
            select: {
              userId: true,
              accountHolderName: true,
              bankName: true,
              accountNumberLast4: true,
              ifscCode: true,
              status: true,
              revision: true,
              verifiedRevision: true,
              fingerprint: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const fingerprints = await this.prisma.payout.findMany({
        where: { id: { in: payouts.map((p) => p.id) } },
        select: { id: true, destinationFingerprint: true },
      });
      const byId = new Map(
        fingerprints.map((p) => [p.id, p.destinationFingerprint]),
      );
      // The readiness check needs fingerprints, but they are compared here and not returned.
      return payouts.map(
        ({ account: { fingerprint, ...account }, ...payout }) => ({
          ...payout,
          account,
          destinationReady:
            this.blockReason(
              {
                ...payout,
                destinationFingerprint: byId.get(payout.id) ?? null,
              },
              { ...account, fingerprint },
              'PROCESSING',
            ) === null,
        }),
      );
    }
    fleetManager(user);
    return this.prisma.payout.findMany({
      where: { account: { userId: user.id } },
      omit: PAYOUT_OMIT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listAccounts(user: { id: string; role: string }) {
    admin(user);
    const accounts = await this.prisma.payoutAccount.findMany({
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, role: true },
        },
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          omit: PAYOUT_OMIT,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return accounts.map((account) => ({
      ...withoutAccountSecrets(account),
      verificationCurrent: destinationVerified(account),
    }));
  }

  async create(user: { id: string; role: string }, body: any) {
    admin(user);
    const accountId = text(body.accountId, 'Payout account', 80);
    const amount = number(body.amount, 'Payout amount', 1, 90000000);
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)
      throw new BadRequestException('Use at most two decimal places');
    const note =
      body.note == null || body.note === ''
        ? null
        : text(body.note, 'Note', 1000);
    const periodStart = periodDate(body.periodStart, 'Period start');
    const periodEnd = periodDate(body.periodEnd, 'Period end', true);
    if (periodStart && periodEnd && periodEnd < periodStart)
      throw new BadRequestException(
        'Period end must be on or after period start',
      );
    return this.prisma.$transaction(async (tx) => {
      const account = await this.lockAccount(tx, accountId);
      if (account.userId === user.id)
        throw new ForbiddenException(
          'Another administrator must create payouts to your own account',
        );
      if (!destinationVerified(account))
        throw new BadRequestException(
          'The payout account must be verified by a second approver for its current bank details before creating a payout',
        );
      const duplicate = await tx.payout.findFirst({
        where: {
          accountId,
          amount,
          periodStart,
          periodEnd,
          status: { in: ['PENDING', 'PROCESSING', 'PAID'] },
          ...(periodStart || periodEnd
            ? {}
            : {
                createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
              }),
        },
      });
      if (duplicate)
        throw new ConflictException(
          'An identical payout already exists for this account and period. Refresh payouts before creating another.',
        );
      return this.createWithSnapshot(tx, user.id, account, {
        amount,
        note,
        periodStart,
        periodEnd,
      });
    });
  }

  async updateStatus(
    user: { id: string; role: string },
    id: string,
    body: any,
  ) {
    admin(user);
    const status = choice(
      body.status,
      'Payout status',
      STATUSES,
    ) as PayoutStatus;
    const reference =
      body.reference == null || body.reference === ''
        ? null
        : text(body.reference, 'Payout reference', 120);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payout.findUnique({
          where: { id },
          select: { accountId: true },
        });
        if (!existing) throw new NotFoundException('Payout not found');
        // Lock the account row so a concurrent bank-detail change or verification cannot interleave with this check.
        const account = await this.lockAccount(tx, existing.accountId);
        const payout = await tx.payout.findUniqueOrThrow({ where: { id } });
        if (account.userId === user.id)
          throw new ForbiddenException(
            'Another administrator must update payouts to your own account',
          );
        const current = payout.status as PayoutStatus;
        // Repeating the current status is only allowed to attach a bank reference that was not recorded earlier.
        const addingReference =
          status === current && reference && !payout.reference;
        if (
          !addingReference &&
          !(PAYOUT_TRANSITIONS[current] || []).includes(status)
        )
          throw new BadRequestException(
            `A ${current} payout cannot be changed to ${status}`,
          );
        // Marking a payout PAID requires the bank transaction reference (UTR) of that transfer in the same request, so an earlier
        // batch or failed-attempt reference is never reused as proof of payment. Earlier references remain in the audit log.
        if (status === 'PAID' && status !== current && !reference)
          throw new BadRequestException(
            'Enter the bank transaction reference (UTR) to mark this payout PAID',
          );
        if (
          (status === 'PROCESSING' || status === 'PAID') &&
          status !== current
        ) {
          const reason = this.blockReason(payout, account, current);
          if (reason)
            throw new DestinationBlocked(reason, BLOCK_MESSAGES[reason]);
        }
        const processedAt = FINAL.includes(status)
          ? status === current
            ? payout.processedAt
            : new Date()
          : null;
        // Only status, reference and processedAt are written; the destination snapshot columns are never updated here.
        const changed = await tx.payout.updateMany({
          where: { id, status: current, reference: payout.reference },
          data: {
            status,
            reference: reference ?? payout.reference,
            processedAt,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Payout changed. Refresh and retry.');
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'PAYOUT_' + status,
            targetId: id,
            detail: JSON.stringify({
              from: current,
              to: status,
              reference: reference ?? payout.reference,
              amount: Number(payout.amount),
              destinationAccountRevision: payout.destinationAccountRevision,
              destinationAccountNumberLast4:
                payout.destinationAccountNumberLast4,
            }),
          },
        });
        return tx.payout.findUniqueOrThrow({
          where: { id },
          omit: PAYOUT_OMIT,
        });
      });
    } catch (error) {
      if (error instanceof DestinationBlocked)
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'PAYOUT_BLOCKED_UNVERIFIED_DESTINATION',
            targetId: id,
            detail: JSON.stringify({ attempted: status, reason: error.reason }),
          },
        });
      throw error;
    }
  }

  // Second-approver verification bound to one account revision. body.revision is the revision the reviewer looked at.
  async updateAccountStatus(
    user: { id: string; role: string },
    id: string,
    body: any,
  ) {
    admin(user);
    const status = choice(body.status, 'Payout account status', [
      'PENDING',
      'VERIFIED',
      'REJECTED',
    ]);
    const revision = number(
      body.revision,
      'Account revision',
      1,
      1_000_000_000,
      true,
    );
    const before = await this.prisma.payoutAccount.findUnique({
      where: { id },
      select: { userId: true, changedById: true },
    });
    if (!before) throw new NotFoundException('Payout account not found');
    if (before.userId === user.id || before.changedById === user.id) {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PAYOUT_ACCOUNT_SELF_APPROVAL_REJECTED',
          targetId: id,
          detail: JSON.stringify({
            attempted: status,
            revision,
            reason:
              before.userId === user.id ? 'ACCOUNT_OWNER' : 'CHANGE_INITIATOR',
          }),
        },
      });
      throw new ForbiddenException(
        'A different administrator from the one who owns or changed these bank details must review them',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const account = (await tx.payoutAccount.findUniqueOrThrow({
        where: { id },
      })) as Account;
      if (account.userId === user.id || account.changedById === user.id)
        throw new ForbiddenException(
          'A different administrator from the one who owns or changed these bank details must review them',
        );
      if (account.revision !== revision)
        throw new ConflictException(
          'These bank details changed after you opened them. Refresh and review the latest version.',
        );
      if (status === 'VERIFIED' && destinationVerified(account))
        throw new ConflictException(
          'This version of the bank details is already verified.',
        );
      if (status === account.status && status !== 'VERIFIED')
        throw new ConflictException(`The payout account is already ${status}.`);
      // Legacy rows have no fingerprint yet; derive it from the stored (encrypted) details before binding approval.
      const fingerprint =
        account.fingerprint ??
        (status === 'VERIFIED' ? this.legacyFingerprint(account) : null);
      if (status === 'VERIFIED' && !fingerprint)
        throw new ConflictException(
          'The stored bank details cannot be read. Ask the host to re-submit them.',
        );
      const changed = await tx.payoutAccount.updateMany({
        where: {
          id,
          revision,
          status: account.status,
          changedById: account.changedById,
        },
        data: {
          status,
          reviewedById: user.id,
          reviewedAt: new Date(),
          verifiedRevision: status === 'VERIFIED' ? revision : null,
          ...(fingerprint ? { fingerprint } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Payout account changed. Refresh and retry.',
        );
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PAYOUT_ACCOUNT_' + status,
          targetId: id,
          detail: JSON.stringify({
            from: account.status,
            to: status,
            revision,
            changedById: account.changedById,
            accountNumberLast4: account.accountNumberLast4,
          }),
        },
      });
      return this.publicAccount(tx, id);
    });
  }

  // Resolves payouts whose destination is unknown (legacy) or no longer the account's verified destination. Snapshots
  // are never edited: CANCEL closes the payout, REISSUE cancels it and creates a replacement against the current
  // verified destination, both in one transaction and both audited.
  async reconcile(user: { id: string; role: string }, id: string, body: any) {
    admin(user);
    const decision = choice(body.decision, 'Reconciliation decision', [
      'CANCEL',
      'REISSUE',
    ]);
    const note = text(body.note, 'Reason', 1000);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.payout.findUnique({
        where: { id },
        select: { accountId: true },
      });
      if (!existing) throw new NotFoundException('Payout not found');
      const account = await this.lockAccount(tx, existing.accountId);
      const payout = await tx.payout.findUniqueOrThrow({ where: { id } });
      if (account.userId === user.id)
        throw new ForbiddenException(
          'Another administrator must reconcile payouts to your own account',
        );
      if (!['PENDING', 'FAILED'].includes(payout.status))
        throw new BadRequestException(
          payout.status === 'PROCESSING'
            ? 'Record the bank result (FAILED) before reconciling a payout that is processing'
            : `A ${payout.status} payout does not need reconciliation`,
        );
      const superseded =
        payout.destinationState === DESTINATION.CAPTURED &&
        destinationVerified(account) &&
        account.fingerprint !== payout.destinationFingerprint;
      if (payout.destinationState === DESTINATION.CAPTURED && !superseded)
        throw new BadRequestException(
          'This payout already has a current verified destination',
        );
      if (decision === 'REISSUE' && !destinationVerified(account))
        throw new BadRequestException(
          'The payout account must be verified by a second approver before a payout can be reissued',
        );
      const cancelled = await tx.payout.updateMany({
        where: { id, status: payout.status },
        data: { status: 'CANCELLED', processedAt: new Date() },
      });
      if (cancelled.count !== 1)
        throw new ConflictException('Payout changed. Refresh and retry.');
      const replacement =
        decision === 'REISSUE'
          ? await this.createWithSnapshot(tx, user.id, account, {
              amount: Number(payout.amount),
              note: payout.note,
              periodStart: payout.periodStart,
              periodEnd: payout.periodEnd,
            })
          : null;
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PAYOUT_RECONCILED',
          targetId: id,
          detail: JSON.stringify({
            decision,
            note,
            previousStatus: payout.status,
            previousDestinationState: payout.destinationState,
            reason: superseded
              ? 'DESTINATION_SUPERSEDED'
              : payout.destinationState,
            replacementPayoutId: replacement?.id ?? null,
          }),
        },
      });
      return {
        cancelled: await tx.payout.findUniqueOrThrow({
          where: { id },
          omit: PAYOUT_OMIT,
        }),
        replacement,
      };
    });
  }

  private async createWithSnapshot(
    tx: any,
    actorId: string,
    account: Account,
    data: {
      amount: number;
      note: string | null;
      periodStart: Date | null;
      periodEnd: Date | null;
    },
  ) {
    const payout = await tx.payout.create({
      data: {
        accountId: account.id,
        ...data,
        destinationState: DESTINATION.CAPTURED,
        destinationAccountHolderName: account.accountHolderName,
        destinationBankName: account.bankName,
        destinationIfscCode: account.ifscCode,
        destinationAccountNumberLast4: account.accountNumberLast4,
        destinationEncryptedAccountNumber: account.encryptedAccountNumber,
        destinationFingerprint: account.fingerprint,
        destinationAccountRevision: account.revision,
        destinationCapturedAt: new Date(),
      },
      omit: PAYOUT_OMIT,
      include: {
        account: {
          select: {
            accountHolderName: true,
            accountNumberLast4: true,
            ifscCode: true,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'PAYOUT_CREATED',
        targetId: payout.id,
        detail: JSON.stringify({ accountId: account.id, ...data }),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'PAYOUT_SNAPSHOT_CREATED',
        targetId: payout.id,
        detail: JSON.stringify({
          accountRevision: account.revision,
          accountNumberLast4: account.accountNumberLast4,
          ifscCode: account.ifscCode,
          reviewedById: (account as any).reviewedById ?? null,
        }),
      },
    });
    return payout;
  }

  // PENDING → PROCESSING/PAID needs a captured snapshot that is still the account's verified destination. A payout that
  // is already PROCESSING went to its snapshot destination, so recording PAID only requires that no unverified change is
  // pending on the account.
  private blockReason(
    payout: {
      destinationState: string;
      destinationFingerprint: string | null;
      destinationEncryptedAccountNumber?: string | null;
    },
    account: Pick<
      Account,
      'status' | 'revision' | 'verifiedRevision' | 'fingerprint'
    >,
    from: string,
  ): BlockReason | null {
    if (payout.destinationState !== DESTINATION.CAPTURED)
      return 'RECONCILIATION_REQUIRED';
    if (!payout.destinationFingerprint) return 'SNAPSHOT_INCOMPLETE';
    if (!destinationVerified(account)) return 'ACCOUNT_UNVERIFIED';
    if (
      from !== 'PROCESSING' &&
      account.fingerprint !== payout.destinationFingerprint
    )
      return 'DESTINATION_SUPERSEDED';
    return null;
  }

  private async lockAccount(tx: any, accountId: string): Promise<Account> {
    // Writing the account row first serializes payout work per account (row lock on PostgreSQL, write lock on SQLite).
    const locked = await tx.payoutAccount.updateMany({
      where: { id: accountId },
      data: { updatedAt: new Date() },
    });
    if (!locked.count) throw new NotFoundException('Payout account not found');
    return tx.payoutAccount.findUniqueOrThrow({ where: { id: accountId } });
  }

  private async publicAccount(tx: any, id: string) {
    const account = await tx.payoutAccount.findUniqueOrThrow({ where: { id } });
    return {
      ...withoutAccountSecrets(account),
      verificationCurrent: destinationVerified(account),
    };
  }

  private key() {
    const raw =
      process.env.PAYOUT_ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
    if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
      throw new ServiceUnavailableException(
        'Payout encryption is not configured',
      );
    return Buffer.from(raw, 'hex');
  }

  private encrypt(accountNumber: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(accountNumber, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  // Internal only: used to fingerprint legacy rows. The plaintext is never returned, logged or audited.
  private decrypt(value: string): string | null {
    try {
      const [iv, tag, data] = value
        .split('.')
        .map((part) => Buffer.from(part, 'base64url'));
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf8',
      );
    } catch {
      return null;
    }
  }

  // Keyed HMAC of the full destination, so identical details are recognised without storing or comparing plaintext.
  private fingerprint(d: {
    accountHolderName: string;
    bankName: string;
    ifscCode: string;
    accountNumber: string;
  }) {
    const key = createHmac('sha256', this.key())
      .update('safar-payout-destination-fingerprint-v1')
      .digest();
    const normalized = [d.accountHolderName, d.bankName]
      .map((v) => v.trim().replace(/\s+/g, ' ').toUpperCase())
      .concat(d.ifscCode.toUpperCase(), d.accountNumber)
      .join('|');
    return 'v1:' + createHmac('sha256', key).update(normalized).digest('hex');
  }

  private legacyFingerprint(
    account: Pick<
      Account,
      'accountHolderName' | 'bankName' | 'ifscCode' | 'encryptedAccountNumber'
    >,
  ) {
    const accountNumber = this.decrypt(account.encryptedAccountNumber);
    return accountNumber
      ? this.fingerprint({ ...account, accountNumber })
      : null;
  }
}

type BlockReason =
  | 'RECONCILIATION_REQUIRED'
  | 'SNAPSHOT_INCOMPLETE'
  | 'ACCOUNT_UNVERIFIED'
  | 'DESTINATION_SUPERSEDED';
const BLOCK_MESSAGES: Record<BlockReason, string> = {
  RECONCILIATION_REQUIRED:
    'This payout has no verified destination on record. Reconcile it (cancel or reissue) before processing.',
  SNAPSHOT_INCOMPLETE:
    'This payout has an incomplete destination record. Reconcile it before processing.',
  ACCOUNT_UNVERIFIED:
    'The host’s bank details changed and are awaiting verification by a second approver. Payouts are on hold until then.',
  DESTINATION_SUPERSEDED:
    'The host’s verified bank details differ from this payout’s destination. Reissue the payout to the current verified account or cancel it.',
};
