"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutsService = exports.DESTINATION = exports.PAYOUT_TRANSITIONS = void 0;
exports.destinationVerified = destinationVerified;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
const ACCOUNT_NUMBER = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const STATUSES = [
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'CANCELLED',
];
exports.PAYOUT_TRANSITIONS = {
    PENDING: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED'],
    PROCESSING: ['PAID', 'FAILED'],
    FAILED: ['PENDING', 'CANCELLED'],
    PAID: [],
    CANCELLED: [],
};
const FINAL = ['PAID', 'FAILED', 'CANCELLED'];
const DUPLICATE_WINDOW_MS = 10 * 60000;
exports.DESTINATION = {
    CAPTURED: 'CAPTURED',
    RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
    LEGACY_UNVERIFIED: 'LEGACY_UNVERIFIED',
};
const ACCOUNT_SECRET_FIELDS = new Set([
    'encryptedAccountNumber',
    'fingerprint',
]);
function withoutAccountSecrets(account) {
    return Object.fromEntries(Object.entries(account).filter(([key]) => !ACCOUNT_SECRET_FIELDS.has(key)));
}
const PAYOUT_OMIT = {
    destinationEncryptedAccountNumber: true,
    destinationFingerprint: true,
};
function periodDate(value, field, endOfDay = false) {
    if (value == null || value === '')
        return null;
    const raw = (0, validation_1.text)(value, field, 40);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(raw + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'))
        : new Date(raw);
    if (!/^\d{4}-\d{2}-\d{2}($|T)/.test(raw) ||
        !Number.isFinite(+date) ||
        date.getUTCFullYear() < 2020 ||
        date.getUTCFullYear() > 2100)
        throw new common_1.BadRequestException(`Enter a valid ${field.toLowerCase()} (YYYY-MM-DD)`);
    return date;
}
function destinationVerified(account) {
    return (account.status === 'VERIFIED' &&
        account.verifiedRevision === account.revision &&
        Boolean(account.fingerprint));
}
class DestinationBlocked extends common_1.ConflictException {
    reason;
    constructor(reason, message) {
        super(message);
        this.reason = reason;
    }
}
let PayoutsService = class PayoutsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAccount(user) {
        (0, validation_1.fleetManager)(user);
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
        if (!account)
            return null;
        return {
            ...withoutAccountSecrets(account),
            verificationCurrent: destinationVerified(account),
        };
    }
    async saveAccount(user, body) {
        (0, validation_1.fleetManager)(user);
        const accountHolderName = (0, validation_1.text)(body.accountHolderName, 'Account holder name', 120).replace(/\s+/g, ' ');
        const bankName = (0, validation_1.text)(body.bankName, 'Bank name', 120).replace(/\s+/g, ' ');
        const accountNumber = (0, validation_1.text)(body.accountNumber, 'Account number', 18).replace(/\s/g, '');
        const ifscCode = (0, validation_1.text)(body.ifscCode, 'IFSC code', 11).toUpperCase();
        if (!ACCOUNT_NUMBER.test(accountNumber))
            throw new common_1.BadRequestException('Enter a valid bank account number');
        if (!IFSC.test(ifscCode))
            throw new common_1.BadRequestException('Enter a valid IFSC code');
        const fingerprint = this.fingerprint({
            accountHolderName,
            bankName,
            ifscCode,
            accountNumber,
        });
        return this.prisma.$transaction(async (tx) => {
            const current = (await tx.payoutAccount.findUnique({
                where: { userId: user.id },
            }));
            const masked = {
                bankName,
                accountNumberLast4: accountNumber.slice(-4),
                ifscCode,
            };
            if (current) {
                const currentFingerprint = current.fingerprint ?? this.legacyFingerprint(current);
                if (currentFingerprint === fingerprint) {
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
                    throw new common_1.ConflictException('Bank details were changed by another request. Refresh and try again.');
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
    async list(user) {
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
            const byId = new Map(fingerprints.map((p) => [p.id, p.destinationFingerprint]));
            return payouts.map(({ account: { fingerprint, ...account }, ...payout }) => ({
                ...payout,
                account,
                destinationReady: this.blockReason({
                    ...payout,
                    destinationFingerprint: byId.get(payout.id) ?? null,
                }, { ...account, fingerprint }, 'PROCESSING') === null,
            }));
        }
        (0, validation_1.fleetManager)(user);
        return this.prisma.payout.findMany({
            where: { account: { userId: user.id } },
            omit: PAYOUT_OMIT,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async listAccounts(user) {
        (0, validation_1.admin)(user);
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
    async create(user, body) {
        (0, validation_1.admin)(user);
        const accountId = (0, validation_1.text)(body.accountId, 'Payout account', 80);
        const amount = (0, validation_1.number)(body.amount, 'Payout amount', 1, 90000000);
        if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)
            throw new common_1.BadRequestException('Use at most two decimal places');
        const note = body.note == null || body.note === ''
            ? null
            : (0, validation_1.text)(body.note, 'Note', 1000);
        const periodStart = periodDate(body.periodStart, 'Period start');
        const periodEnd = periodDate(body.periodEnd, 'Period end', true);
        if (periodStart && periodEnd && periodEnd < periodStart)
            throw new common_1.BadRequestException('Period end must be on or after period start');
        return this.prisma.$transaction(async (tx) => {
            const account = await this.lockAccount(tx, accountId);
            if (account.userId === user.id)
                throw new common_1.ForbiddenException('Another administrator must create payouts to your own account');
            if (!destinationVerified(account))
                throw new common_1.BadRequestException('The payout account must be verified by a second approver for its current bank details before creating a payout');
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
                throw new common_1.ConflictException('An identical payout already exists for this account and period. Refresh payouts before creating another.');
            return this.createWithSnapshot(tx, user.id, account, {
                amount,
                note,
                periodStart,
                periodEnd,
            });
        });
    }
    async updateStatus(user, id, body) {
        (0, validation_1.admin)(user);
        const status = (0, validation_1.choice)(body.status, 'Payout status', STATUSES);
        const reference = body.reference == null || body.reference === ''
            ? null
            : (0, validation_1.text)(body.reference, 'Payout reference', 120);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.payout.findUnique({
                    where: { id },
                    select: { accountId: true },
                });
                if (!existing)
                    throw new common_1.NotFoundException('Payout not found');
                const account = await this.lockAccount(tx, existing.accountId);
                const payout = await tx.payout.findUniqueOrThrow({ where: { id } });
                if (account.userId === user.id)
                    throw new common_1.ForbiddenException('Another administrator must update payouts to your own account');
                const current = payout.status;
                const addingReference = status === current && reference && !payout.reference;
                if (!addingReference &&
                    !(exports.PAYOUT_TRANSITIONS[current] || []).includes(status))
                    throw new common_1.BadRequestException(`A ${current} payout cannot be changed to ${status}`);
                if (status === 'PAID' && status !== current && !reference)
                    throw new common_1.BadRequestException('Enter the bank transaction reference (UTR) to mark this payout PAID');
                if ((status === 'PROCESSING' || status === 'PAID') &&
                    status !== current) {
                    const reason = this.blockReason(payout, account, current);
                    if (reason)
                        throw new DestinationBlocked(reason, BLOCK_MESSAGES[reason]);
                }
                const processedAt = FINAL.includes(status)
                    ? status === current
                        ? payout.processedAt
                        : new Date()
                    : null;
                const changed = await tx.payout.updateMany({
                    where: { id, status: current, reference: payout.reference },
                    data: {
                        status,
                        reference: reference ?? payout.reference,
                        processedAt,
                    },
                });
                if (changed.count !== 1)
                    throw new common_1.ConflictException('Payout changed. Refresh and retry.');
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
                            destinationAccountNumberLast4: payout.destinationAccountNumberLast4,
                        }),
                    },
                });
                return tx.payout.findUniqueOrThrow({
                    where: { id },
                    omit: PAYOUT_OMIT,
                });
            });
        }
        catch (error) {
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
    async updateAccountStatus(user, id, body) {
        (0, validation_1.admin)(user);
        const status = (0, validation_1.choice)(body.status, 'Payout account status', [
            'PENDING',
            'VERIFIED',
            'REJECTED',
        ]);
        const revision = (0, validation_1.number)(body.revision, 'Account revision', 1, 1_000_000_000, true);
        const before = await this.prisma.payoutAccount.findUnique({
            where: { id },
            select: { userId: true, changedById: true },
        });
        if (!before)
            throw new common_1.NotFoundException('Payout account not found');
        if (before.userId === user.id || before.changedById === user.id) {
            await this.prisma.auditLog.create({
                data: {
                    actorId: user.id,
                    action: 'PAYOUT_ACCOUNT_SELF_APPROVAL_REJECTED',
                    targetId: id,
                    detail: JSON.stringify({
                        attempted: status,
                        revision,
                        reason: before.userId === user.id ? 'ACCOUNT_OWNER' : 'CHANGE_INITIATOR',
                    }),
                },
            });
            throw new common_1.ForbiddenException('A different administrator from the one who owns or changed these bank details must review them');
        }
        return this.prisma.$transaction(async (tx) => {
            const account = (await tx.payoutAccount.findUniqueOrThrow({
                where: { id },
            }));
            if (account.userId === user.id || account.changedById === user.id)
                throw new common_1.ForbiddenException('A different administrator from the one who owns or changed these bank details must review them');
            if (account.revision !== revision)
                throw new common_1.ConflictException('These bank details changed after you opened them. Refresh and review the latest version.');
            if (status === 'VERIFIED' && destinationVerified(account))
                throw new common_1.ConflictException('This version of the bank details is already verified.');
            if (status === account.status && status !== 'VERIFIED')
                throw new common_1.ConflictException(`The payout account is already ${status}.`);
            const fingerprint = account.fingerprint ??
                (status === 'VERIFIED' ? this.legacyFingerprint(account) : null);
            if (status === 'VERIFIED' && !fingerprint)
                throw new common_1.ConflictException('The stored bank details cannot be read. Ask the host to re-submit them.');
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
                throw new common_1.ConflictException('Payout account changed. Refresh and retry.');
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
    async reconcile(user, id, body) {
        (0, validation_1.admin)(user);
        const decision = (0, validation_1.choice)(body.decision, 'Reconciliation decision', [
            'CANCEL',
            'REISSUE',
        ]);
        const note = (0, validation_1.text)(body.note, 'Reason', 1000);
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.payout.findUnique({
                where: { id },
                select: { accountId: true },
            });
            if (!existing)
                throw new common_1.NotFoundException('Payout not found');
            const account = await this.lockAccount(tx, existing.accountId);
            const payout = await tx.payout.findUniqueOrThrow({ where: { id } });
            if (account.userId === user.id)
                throw new common_1.ForbiddenException('Another administrator must reconcile payouts to your own account');
            if (!['PENDING', 'FAILED'].includes(payout.status))
                throw new common_1.BadRequestException(payout.status === 'PROCESSING'
                    ? 'Record the bank result (FAILED) before reconciling a payout that is processing'
                    : `A ${payout.status} payout does not need reconciliation`);
            const superseded = payout.destinationState === exports.DESTINATION.CAPTURED &&
                destinationVerified(account) &&
                account.fingerprint !== payout.destinationFingerprint;
            if (payout.destinationState === exports.DESTINATION.CAPTURED && !superseded)
                throw new common_1.BadRequestException('This payout already has a current verified destination');
            if (decision === 'REISSUE' && !destinationVerified(account))
                throw new common_1.BadRequestException('The payout account must be verified by a second approver before a payout can be reissued');
            const cancelled = await tx.payout.updateMany({
                where: { id, status: payout.status },
                data: { status: 'CANCELLED', processedAt: new Date() },
            });
            if (cancelled.count !== 1)
                throw new common_1.ConflictException('Payout changed. Refresh and retry.');
            const replacement = decision === 'REISSUE'
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
    async createWithSnapshot(tx, actorId, account, data) {
        const payout = await tx.payout.create({
            data: {
                accountId: account.id,
                ...data,
                destinationState: exports.DESTINATION.CAPTURED,
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
                    reviewedById: account.reviewedById ?? null,
                }),
            },
        });
        return payout;
    }
    blockReason(payout, account, from) {
        if (payout.destinationState !== exports.DESTINATION.CAPTURED)
            return 'RECONCILIATION_REQUIRED';
        if (!payout.destinationFingerprint)
            return 'SNAPSHOT_INCOMPLETE';
        if (!destinationVerified(account))
            return 'ACCOUNT_UNVERIFIED';
        if (from !== 'PROCESSING' &&
            account.fingerprint !== payout.destinationFingerprint)
            return 'DESTINATION_SUPERSEDED';
        return null;
    }
    async lockAccount(tx, accountId) {
        const locked = await tx.payoutAccount.updateMany({
            where: { id: accountId },
            data: { updatedAt: new Date() },
        });
        if (!locked.count)
            throw new common_1.NotFoundException('Payout account not found');
        return tx.payoutAccount.findUniqueOrThrow({ where: { id: accountId } });
    }
    async publicAccount(tx, id) {
        const account = await tx.payoutAccount.findUniqueOrThrow({ where: { id } });
        return {
            ...withoutAccountSecrets(account),
            verificationCurrent: destinationVerified(account),
        };
    }
    key() {
        const raw = process.env.PAYOUT_ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
        if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
            throw new common_1.ServiceUnavailableException('Payout encryption is not configured');
        return Buffer.from(raw, 'hex');
    }
    encrypt(accountNumber) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', this.key(), iv);
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
    decrypt(value) {
        try {
            const [iv, tag, data] = value
                .split('.')
                .map((part) => Buffer.from(part, 'base64url'));
            const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', this.key(), iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
        }
        catch {
            return null;
        }
    }
    fingerprint(d) {
        const key = (0, node_crypto_1.createHmac)('sha256', this.key())
            .update('safar-payout-destination-fingerprint-v1')
            .digest();
        const normalized = [d.accountHolderName, d.bankName]
            .map((v) => v.trim().replace(/\s+/g, ' ').toUpperCase())
            .concat(d.ifscCode.toUpperCase(), d.accountNumber)
            .join('|');
        return 'v1:' + (0, node_crypto_1.createHmac)('sha256', key).update(normalized).digest('hex');
    }
    legacyFingerprint(account) {
        const accountNumber = this.decrypt(account.encryptedAccountNumber);
        return accountNumber
            ? this.fingerprint({ ...account, accountNumber })
            : null;
    }
};
exports.PayoutsService = PayoutsService;
exports.PayoutsService = PayoutsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PayoutsService);
const BLOCK_MESSAGES = {
    RECONCILIATION_REQUIRED: 'This payout has no verified destination on record. Reconcile it (cancel or reissue) before processing.',
    SNAPSHOT_INCOMPLETE: 'This payout has an incomplete destination record. Reconcile it before processing.',
    ACCOUNT_UNVERIFIED: 'The host’s bank details changed and are awaiting verification by a second approver. Payouts are on hold until then.',
    DESTINATION_SUPERSEDED: 'The host’s verified bank details differ from this payout’s destination. Reissue the payout to the current verified account or cancel it.',
};
//# sourceMappingURL=payouts.service.js.map