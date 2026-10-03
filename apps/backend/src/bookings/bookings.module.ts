import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { InvoicesController } from './invoices.controller';

@Module({
  controllers: [BookingsController, InvoicesController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
