import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}
  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
  async deposit(_userId: string, _amount: number) {
    throw new ForbiddenException('Wallet deposits require a verified payment provider. Self-credit is disabled.');
  }
}

