import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards, ForbiddenException } from '@nestjs/common';
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

  @Get('staff')
  listStaff(@Request() req: any) {
    if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Dealer or host access required');
    }
    return this.account.listStaff(req.user.id);
  }

  @Post('staff')
  createStaff(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Dealer or host access required');
    }
    return this.account.createStaff(req.user.id, body);
  }

  @Delete('staff/:id')
  deleteStaff(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Dealer or host access required');
    }
    return this.account.deleteStaff(req.user.id, id);
  }
}
