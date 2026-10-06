import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('vehicle/:vehicleId')
  list(@Param('vehicleId') vehicleId: string) {
    return this.reviews.listForVehicle(vehicleId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req: any, @Body() body: any) {
    return this.reviews.create(req.user.id, body);
  }

  @Get('user/:userId')
  listForUser(@Param('userId') userId: string) {
    return this.reviews.listForUser(userId);
  }

  @Post('party')
  @UseGuards(JwtAuthGuard)
  createParty(@Request() req: any, @Body() body: any) {
    return this.reviews.createParty(req.user, body);
  }
}
