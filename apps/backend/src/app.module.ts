import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BookingsModule } from './bookings/bookings.module';
import { WalletModule } from './wallet/wallet.module';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { KycController } from './kyc/kyc.controller';
import { SandboxService } from './kyc/sandbox.service';
import { DocumentEvidenceService } from './kyc/document-evidence.service';
import { AdminController } from './admin/admin.controller';
import { AccountModule } from './account/account.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PayoutsModule } from './payouts/payouts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContactController } from './contact/contact.controller';
import { PaymentWebhookController } from './payments/payment-webhook.controller';
import { OperationsModule } from './operations/operations.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    VehiclesModule,
    BookingsModule,
    WalletModule,
    AccountModule,
    ReviewsModule,
    PayoutsModule,
    NotificationsModule,
    OperationsModule,
    PaymentsModule,
  ],
  controllers: [AppController, MediaController, KycController, AdminController, ContactController, PaymentWebhookController],
  providers: [AppService, MediaService, SandboxService, DocumentEvidenceService],
})
export class AppModule {}
