import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('dashboard')
  dashboard(@Request() req: any) {
    return this.account.dashboard(req.user);
  }

  @Post('profile')
  updateProfile(@Request() req: any, @Body() body: any) {
    return this.account.updateProfile(req.user.id, body);
  }

  @Post('password')
  changePassword(@Request() req: any, @Body() body: any) {
    return this.account.changePassword(req.user.id, body);
  }

  @Get('disputes')
  listDisputes(@Request() req: any) {
    return this.account.listDisputes(req.user.id);
  }

  @Post('disputes')
  createDispute(@Request() req: any, @Body() body: any) {
    return this.account.createDispute(req.user.id, body);
  }

  @Post('delete-request')
  requestAccountDeletion(@Request() req: any, @Body() body: any) {
    return this.account.requestAccountDeletion(req.user.id, body);
  }
}
