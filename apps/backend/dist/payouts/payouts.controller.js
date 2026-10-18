"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const payouts_service_1 = require("./payouts.service");
let PayoutsController = class PayoutsController {
    payouts;
    constructor(payouts) {
        this.payouts = payouts;
    }
    account(req) { return this.payouts.getAccount(req.user); }
    saveAccount(req, body) { return this.payouts.saveAccount(req.user, body); }
    list(req) { return this.payouts.list(req.user); }
    accounts(req) { return this.payouts.listAccounts(req.user); }
    create(req, body) { return this.payouts.create(req.user, body); }
    status(req, id, body) { return this.payouts.updateStatus(req.user, id, body); }
    accountStatus(req, id, body) { return this.payouts.updateAccountStatus(req.user, id, body); }
};
exports.PayoutsController = PayoutsController;
__decorate([
    (0, common_1.Get)('account'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "account", null);
__decorate([
    (0, common_1.Post)('account'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "saveAccount", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('accounts'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "accounts", null);
__decorate([
    (0, common_1.Post)('admin/create'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/status'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('accounts/:id/status'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], PayoutsController.prototype, "accountStatus", null);
exports.PayoutsController = PayoutsController = __decorate([
    (0, common_1.Controller)('payouts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [payouts_service_1.PayoutsService])
], PayoutsController);
//# sourceMappingURL=payouts.controller.js.map