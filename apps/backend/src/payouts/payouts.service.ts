import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { admin, choice, fleetManager, number, text } from '../common/validation';

const ACCOUNT_NUMBER = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'] as const;

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(user: { id: string; role: string }) {
    fleetManager(user);
    return this.prisma.payoutAccount.findUnique({ where: { userId: user.id }, include: { payouts: { orderBy: { createdAt: 'desc' }, take: 50 } } });
  }

  async saveAccount(user: { id: string; role: string }, body: any) {
    fleetManager(user);
    const accountHolderName = text(body.accountHolderName, 'Account holder name', 120);
    const bankName = text(body.bankName, 'Bank name', 120);
    const accountNumber = text(body.accountNumber, 'Account number', 18).replace(/\s/g, '');
    const ifscCode = text(body.ifscCode, 'IFSC code', 11).toUpperCase();
    if (!ACCOUNT_NUMBER.test(accountNumber)) throw new BadRequestException('Enter a valid bank account number');
    if (!IFSC.test(ifscCode)) throw new BadRequestException('Enter a valid IFSC code');
    const encryptedAccountNumber = this.encrypt(accountNumber);
    return this.prisma.payoutAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, accountHolderName, bankName, accountNumberLast4: accountNumber.slice(-4), ifscCode, encryptedAccountNumber, status: 'PENDING' },
      update: { accountHolderName, bankName, accountNumberLast4: accountNumber.slice(-4), ifscCode, encryptedAccountNumber, status: 'PENDING' },
      select: { id: true, userId: true, accountHolderName: true, bankName: true, accountNumberLast4: true, ifscCode: true, status: true, createdAt: true, updatedAt: true },
    });
  }

  async list(user: { id: string; role: string }) {
    if (user.role === 'ADMIN') return this.prisma.payout.findMany({
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
    fleetManager(user);
    return this.prisma.payout.findMany({ where: { account: { userId: user.id } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async listAccounts(user: { id: string; role: string }) {
    admin(user);
    return this.prisma.payoutAccount.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } },
        payouts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }

  async create(user: { id: string; role: string }, body: any) {
    admin(user);
    const accountId = text(body.accountId, 'Payout account', 80);
    const amount = number(body.amount, 'Payout amount', 1, 90000000);
    const note = body.note == null || body.note === '' ? null : text(body.note, 'Note', 1000);
    const account = await this.prisma.payoutAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Payout account not found');
    if (account.status !== 'VERIFIED') throw new BadRequestException('Verify the payout account before creating a payout');
    return this.prisma.payout.create({ data: { accountId, amount, note, periodStart: body.periodStart ? new Date(body.periodStart) : null, periodEnd: body.periodEnd ? new Date(body.periodEnd) : null }, include: { account: { select: { accountHolderName: true, accountNumberLast4: true, ifscCode: true } } } });
  }

  async updateStatus(user: { id: string; role: string }, id: string, body: any) {
    admin(user);
    const status = choice(body.status, 'Payout status', STATUSES);
    const reference = body.reference == null || body.reference === '' ? null : text(body.reference, 'Payout reference', 120);
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    return this.prisma.payout.update({ where: { id }, data: { status, reference, processedAt: ['PAID', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : null } });
  }

  async updateAccountStatus(user: { id: string; role: string }, id: string, body: any) {
    admin(user);
    const status = choice(body.status, 'Payout account status', ['PENDING', 'VERIFIED', 'REJECTED']);
    const account = await this.prisma.payoutAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Payout account not found');
    return this.prisma.payoutAccount.update({ where: { id }, data: { status }, select: { id: true, userId: true, accountHolderName: true, bankName: true, accountNumberLast4: true, ifscCode: true, status: true } });
  }

  private encrypt(accountNumber: string) {
    const raw = process.env.PAYOUT_ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
    if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new ServiceUnavailableException('Payout encryption is not configured');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(raw, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
    return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  }
}
