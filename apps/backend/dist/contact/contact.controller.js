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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactController = void 0;
exports.businessContact = businessContact;
const common_1 = require("@nestjs/common");
function businessContact(env = process.env) {
    const clean = (value, max) => {
        const trimmed = value?.trim();
        return trimmed && trimmed.length <= max ? trimmed : null;
    };
    const phone = clean(env.BUSINESS_PHONE, 20);
    const phoneDigits = phone && /^\+?[0-9][0-9 -]{6,18}$/.test(phone)
        ? phone.replace(/[^0-9]/g, '')
        : null;
    const email = clean(env.BUSINESS_EMAIL, 254);
    return {
        name: clean(env.BUSINESS_NAME, 120) || 'Safar Self Drive',
        phone: phoneDigits ? phone : null,
        whatsapp: phoneDigits && phoneDigits.length >= 10 ? phoneDigits : null,
        email: email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)
            ? email
            : null,
        address: clean(env.BUSINESS_ADDRESS, 500),
    };
}
let ContactController = class ContactController {
    contact() {
        return businessContact();
    }
};
exports.ContactController = ContactController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContactController.prototype, "contact", null);
exports.ContactController = ContactController = __decorate([
    (0, common_1.Controller)('contact')
], ContactController);
//# sourceMappingURL=contact.controller.js.map