import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { InvoicesController } from './invoices.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController, InvoicesController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
