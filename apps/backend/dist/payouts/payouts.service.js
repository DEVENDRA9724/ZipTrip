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
exports.PayoutsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
const ACCOUNT_NUMBER = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'];
let PayoutsService = class PayoutsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAccount(user) {
        (0, validation_1.fleetManager)(user);
        return this.prisma.payoutAccount.findUnique({ where: { userId: user.id }, include: { payouts: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    }
    async saveAccount(user, body) {
        (0, validation_1.fleetManager)(user);
        const accountHolderName = (0, validation_1.text)(body.accountHolderName, 'Account holder name', 120);
        const bankName = (0, validation_1.text)(body.bankName, 'Bank name', 120);
        const accountNumber = (0, validation_1.text)(body.accountNumber, 'Account number', 18).replace(/\s/g, '');
        const ifscCode = (0, validation_1.text)(body.ifscCode, 'IFSC code', 11).toUpperCase();
        if (!ACCOUNT_NUMBER.test(accountNumber))
            throw new common_1.BadRequestException('Enter a valid bank account number');
        if (!IFSC.test(ifscCode))
            throw new common_1.BadRequestException('Enter a valid IFSC code');
        const encryptedAccountNumber = this.encrypt(accountNumber);
        return this.prisma.payoutAccount.upsert({
            where: { userId: user.id },
            create: { userId: user.id, accountHolderName, bankName, accountNumberLast4: accountNumber.slice(-4), ifscCode, encryptedAccountNumber, status: 'PENDING' },
            update: { accountHolderName, bankName, accountNumberLast4: accountNumber.slice(-4), ifscCode, encryptedAccountNumber, status: 'PENDING' },
            select: { id: true, userId: true, accountHolderName: true, bankName: true, accountNumberLast4: true, ifscCode: true, status: true, createdAt: true, updatedAt: true },
        });
    }
    async list(user) {
        if (user.role === 'ADMIN')
            return this.prisma.payout.findMany({
                include: {
                    account: {
                        select: {
                            userId: true, accountHolderName: true, bankName: true,
                            accountNumberLast4: true, ifscCode: true, status: true,
                            user: { select: { firstName: true, lastName: true, email: true, role: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 500,
            });
        (0, validation_1.fleetManager)(user);
        return this.prisma.payout.findMany({ where: { account: { userId: user.id } }, orderBy: { createdAt: 'desc' }, take: 100 });
    }
    async listAccounts(user) {
        (0, validation_1.admin)(user);
        return this.prisma.payoutAccount.findMany({
            include: {
                user: { select: { firstName: true, lastName: true, email: true, role: true } },
                payouts: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
            orderBy: { updatedAt: 'desc' },
            take: 500,
        });
    }
    async create(user, body) {
        (0, validation_1.admin)(user);
        const accountId = (0, validation_1.text)(body.accountId, 'Payout account', 80);
        const amount = (0, validation_1.number)(body.amount, 'Payout amount', 1, 90000000);
        const note = body.note == null || body.note === '' ? null : (0, validation_1.text)(body.note, 'Note', 1000);
        const account = await this.prisma.payoutAccount.findUnique({ where: { id: accountId } });
        if (!account)
            throw new common_1.NotFoundException('Payout account not found');
        if (account.status !== 'VERIFIED')
            throw new common_1.BadRequestException('Verify the payout account before creating a payout');
        return this.prisma.payout.create({ data: { accountId, amount, note, periodStart: body.periodStart ? new Date(body.periodStart) : null, periodEnd: body.periodEnd ? new Date(body.periodEnd) : null }, include: { account: { select: { accountHolderName: true, accountNumberLast4: true, ifscCode: true } } } });
    }
    async updateStatus(user, id, body) {
        (0, validation_1.admin)(user);
        const status = (0, validation_1.choice)(body.status, 'Payout status', STATUSES);
        const reference = body.reference == null || body.reference === '' ? null : (0, validation_1.text)(body.reference, 'Payout reference', 120);
        const payout = await this.prisma.payout.findUnique({ where: { id } });
        if (!payout)
            throw new common_1.NotFoundException('Payout not found');
        return this.prisma.payout.update({ where: { id }, data: { status, reference, processedAt: ['PAID', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : null } });
    }
    async updateAccountStatus(user, id, body) {
        (0, validation_1.admin)(user);
        const status = (0, validation_1.choice)(body.status, 'Payout account status', ['PENDING', 'VERIFIED', 'REJECTED']);
        const account = await this.prisma.payoutAccount.findUnique({ where: { id } });
        if (!account)
            throw new common_1.NotFoundException('Payout account not found');
        return this.prisma.payoutAccount.update({ where: { id }, data: { status }, select: { id: true, userId: true, accountHolderName: true, bankName: true, accountNumberLast4: true, ifscCode: true, status: true } });
    }
    encrypt(accountNumber) {
        const raw = process.env.PAYOUT_ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
        if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
            throw new common_1.ServiceUnavailableException('Payout encryption is not configured');
        const iv = (0, node_crypto_1.randomBytes)(12);
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', Buffer.from(raw, 'hex'), iv);
        const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
        return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
    }
};
exports.PayoutsService = PayoutsService;
exports.PayoutsService = PayoutsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PayoutsService);
//# sourceMappingURL=payouts.service.js.map