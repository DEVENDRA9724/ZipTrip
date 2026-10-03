import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getBalance(@Request() req: any) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('deposit')
  async deposit(@Request() req: any, @Body('amount') amount: number) {
    return this.walletService.deposit(req.user.id, Number(amount));
  }
}
