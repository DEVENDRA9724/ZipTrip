import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
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

  @Post(':id/cancel')
  async cancel(@Request() req: any, @Param('id') id: string) {
    return this.bookingsService.cancel(req.user.id, id);
  }
}
