import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('account')
  account(@Request() req: any) { return this.payouts.getAccount(req.user); }

  @Post('account')
  saveAccount(@Request() req: any, @Body() body: any) { return this.payouts.saveAccount(req.user, body); }

  @Get()
  list(@Request() req: any) { return this.payouts.list(req.user); }

  @Get('accounts')
  accounts(@Request() req: any) { return this.payouts.listAccounts(req.user); }

  @Post('admin/create')
  create(@Request() req: any, @Body() body: any) { return this.payouts.create(req.user, body); }

  @Post(':id/status')
  status(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.payouts.updateStatus(req.user, id, body); }

  @Post('accounts/:id/status')
  accountStatus(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.payouts.updateAccountStatus(req.user, id, body); }
}
