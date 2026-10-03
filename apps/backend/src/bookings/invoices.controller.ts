import { Controller, Get, Param, Request, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private prisma: PrismaService) {}
  @Get(':id')
  async get(@Request() req: any, @Param('id') id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { booking: { include: { vehicle: true } } } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.booking.customerId !== req.user.id && invoice.booking.vehicle.hostId !== req.user.id && req.user.role !== 'ADMIN') throw new ForbiddenException('Invoice access denied');
    const { booking, snapshot, ...result } = invoice;
    return { ...result, bookingRef: booking.bookingRef, details: JSON.parse(snapshot) };
  }
}
