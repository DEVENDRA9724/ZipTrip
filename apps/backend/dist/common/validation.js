"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_KINDS = exports.INSPECTION_KINDS = exports.PHOTO_KINDS = exports.FLEET_ROLES = void 0;
exports.text = text;
exports.number = number;
exports.choice = choice;
exports.admin = admin;
exports.fleetManager = fleetManager;
const common_1 = require("@nestjs/common");
function text(value, field, max = 120) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
        throw new common_1.BadRequestException(`${field} is required (maximum ${max} characters)`);
    }
    return value.trim();
}
function number(value, field, min, max, integer = false) {
    if ((typeof value !== 'number' && typeof value !== 'string') || value === '')
        throw new common_1.BadRequestException(`Invalid ${field}`);
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
        throw new common_1.BadRequestException(`Invalid ${field}`);
    return n;
}
function choice(value, field, values) {
    if (typeof value !== 'string' || !values.includes(value))
        throw new common_1.BadRequestException(`Invalid ${field}`);
    return value;
}
function admin(user) {
    if (user.role !== 'ADMIN')
        throw new common_1.ForbiddenException('Administrator access required');
}
exports.FLEET_ROLES = ['HOST', 'DEALER', 'ADMIN'];
function fleetManager(user) {
    if (!exports.FLEET_ROLES.includes(user.role))
        throw new common_1.ForbiddenException('Host or dealer account required');
}
exports.PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];
exports.INSPECTION_KINDS = ['ODOMETER', 'SELFIE_PICKUP', 'SELFIE_RETURN', 'SELFIE_KYC', 'DAMAGE', 'INSPECTION_PICKUP', 'INSPECTION_RETURN'];
exports.DOCUMENT_KINDS = ['AADHAAR', 'DL', 'RC', 'INSURANCE', 'PUC'];
//# sourceMappingURL=validation.js.map