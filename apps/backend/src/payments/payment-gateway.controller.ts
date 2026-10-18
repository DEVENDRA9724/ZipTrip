import { Controller, Post, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentGatewayService } from './payment-gateway.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentGatewayController {
  constructor(private readonly payments: PaymentGatewayService) {}

  @Post('bookings/:id/checkout')
  createCheckout(@Request() req: any, @Param('id') id: string) {
    return this.payments.createRazorpayOrder(req.user.id, id);
  }
}
