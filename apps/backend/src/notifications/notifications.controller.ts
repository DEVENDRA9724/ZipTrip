import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Request() req: any) { return this.notifications.list(req.user.id); }

  @Post('read-all')
  readAll(@Request() req: any) { return this.notifications.markAllRead(req.user.id); }

  @Post(':id/read')
  read(@Request() req: any, @Param('id') id: string) { return this.notifications.markRead(req.user.id, id); }
}
