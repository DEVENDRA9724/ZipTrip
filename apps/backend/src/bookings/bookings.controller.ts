import { Controller, Post, Get, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    return this.bookingsService.create(req.user.id, body);
  }

  @Get('my-trips')
  async getMyTrips(@Request() req: any) {
    return this.bookingsService.getMyTrips(req.user.id);
  }

  @Get('host-bookings')
  async getHostBookings(@Request() req: any) {
    return this.bookingsService.getHostBookings(req.user.id);
  }

  @Get(':id/agreement')
  async agreement(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.agreement(req.user, id);
  }

  @Get(':id/agreement/pdf')
  async agreementPdf(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const document = await this.bookingsService.agreementPdf(req.user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.send(document.buffer);
  }

  @Post(':id/agreement/acknowledge')
  async acknowledgeAgreement(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.acknowledgeAgreement(req.user, id);
  }

  @Post(':id/cancel')
  async cancel(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.cancel(req.user.id, id);
  }

  @Post(':id/inspection')
  inspect(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bookingsService.inspect(req.user, id, body);
  }
}
