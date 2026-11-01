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
exports.AccountController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const account_service_1 = require("./account.service");
let AccountController = class AccountController {
    account;
    constructor(account) {
        this.account = account;
    }
    dashboard(req) {
        return this.account.dashboard(req.user);
    }
    updateProfile(req, body) {
        return this.account.updateProfile(req.user.id, body);
    }
    changePassword(req, body) {
        return this.account.changePassword(req.user.id, body);
    }
    listDisputes(req) {
        return this.account.listDisputes(req.user.id);
    }
    createDispute(req, body) {
        return this.account.createDispute(req.user.id, body);
    }
    requestAccountDeletion(req, body) {
        return this.account.requestAccountDeletion(req.user.id, body);
    }
    listStaff(req) {
        if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Dealer or host access required');
        }
        return this.account.listStaff(req.user.id);
    }
    createStaff(req, body) {
        if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Dealer or host access required');
        }
        return this.account.createStaff(req.user.id, body);
    }
    deleteStaff(req, id) {
        if (req.user.role !== 'DEALER' && req.user.role !== 'HOST' && req.user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Dealer or host access required');
        }
        return this.account.deleteStaff(req.user.id, id);
    }
};
exports.AccountController = AccountController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('profile'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('password'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('disputes'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "listDisputes", null);
__decorate([
    (0, common_1.Post)('disputes'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "createDispute", null);
__decorate([
    (0, common_1.Post)('delete-request'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "requestAccountDeletion", null);
__decorate([
    (0, common_1.Get)('staff'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "listStaff", null);
__decorate([
    (0, common_1.Post)('staff'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "createStaff", null);
__decorate([
    (0, common_1.Delete)('staff/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AccountController.prototype, "deleteStaff", null);
exports.AccountController = AccountController = __decorate([
    (0, common_1.Controller)('account'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [account_service_1.AccountService])
], AccountController);
//# sourceMappingURL=account.controller.js.map