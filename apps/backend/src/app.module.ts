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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    VehiclesModule,
    BookingsModule,
    WalletModule,
  ],
  controllers: [AppController, MediaController, KycController, AdminController],
  providers: [AppService, MediaService, SandboxService, DocumentEvidenceService],
})
export class AppModule {}
