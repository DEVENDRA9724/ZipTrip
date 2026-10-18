"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const vehicles_module_1 = require("./vehicles/vehicles.module");
const bookings_module_1 = require("./bookings/bookings.module");
const wallet_module_1 = require("./wallet/wallet.module");
const media_controller_1 = require("./media/media.controller");
const media_service_1 = require("./media/media.service");
const kyc_controller_1 = require("./kyc/kyc.controller");
const sandbox_service_1 = require("./kyc/sandbox.service");
const document_evidence_service_1 = require("./kyc/document-evidence.service");
const admin_controller_1 = require("./admin/admin.controller");
const account_module_1 = require("./account/account.module");
const reviews_module_1 = require("./reviews/reviews.module");
const payouts_module_1 = require("./payouts/payouts.module");
const notifications_module_1 = require("./notifications/notifications.module");
const payment_webhook_controller_1 = require("./payments/payment-webhook.controller");
const operations_module_1 = require("./operations/operations.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            vehicles_module_1.VehiclesModule,
            bookings_module_1.BookingsModule,
            wallet_module_1.WalletModule,
            account_module_1.AccountModule,
            reviews_module_1.ReviewsModule,
            payouts_module_1.PayoutsModule,
            notifications_module_1.NotificationsModule,
            operations_module_1.OperationsModule,
        ],
        controllers: [app_controller_1.AppController, media_controller_1.MediaController, kyc_controller_1.KycController, admin_controller_1.AdminController, payment_webhook_controller_1.PaymentWebhookController],
        providers: [app_service_1.AppService, media_service_1.MediaService, sandbox_service_1.SandboxService, document_evidence_service_1.DocumentEvidenceService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map