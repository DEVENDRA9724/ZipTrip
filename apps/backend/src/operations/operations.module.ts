import { Module } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
