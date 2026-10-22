import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { HoldExpiryService } from './hold-expiry.service';
import { BookingsController } from './bookings.controller';
import { InvoicesController } from './invoices.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController, InvoicesController],
  providers: [BookingsService, HoldExpiryService],
  exports: [BookingsService, HoldExpiryService],
})
export class BookingsModule {}
