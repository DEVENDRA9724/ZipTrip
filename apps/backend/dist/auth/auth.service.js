"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const validation_1 = require("../common/validation");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const node_crypto_1 = require("node:crypto");
const msg91_service_1 = require("./msg91.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    msg91;
    constructor(prisma, jwtService, msg91) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.msg91 = msg91;
    }
    sha256(val) {
        return (0, node_crypto_1.createHash)('sha256').update(String(val)).digest('hex');
    }
    isMsg91() {
        return this.msg91.isEnabled();
    }
    exposeDevOtp() {
        return process.env.NODE_ENV !== 'production' && !this.isMsg91() && process.env.OTP_PROVIDER !== 'live';
    }
    async findByPhone(phone) {
        const normalized = this.msg91.normalizePhone(phone);
        const candidates = [normalized, normalized.slice(1)];
        return this.prisma.user.findFirst({
            where: { OR: candidates.map(value => ({ phone: value })) },
            include: { wallet: true, profile: true },
        });
    }
    sanitizeUser(user) {
        if (!user)
            return null;
        const { passwordHash: _p, otpCodeHash: _o, ...rest } = user;
        return rest;
    }
    async register(data) {
        data.email = (0, validation_1.text)(data.email, 'Email', 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
            throw new common_1.BadRequestException('Invalid email');
        if (typeof data.password !== 'string' || data.password.length < 8 || Buffer.byteLength(data.password) > 72) {
            throw new common_1.BadRequestException('Password must be 8–72 characters');
        }
        data.firstName = (0, validation_1.text)(data.firstName, 'First name', 60);
        data.lastName = (0, validation_1.text)(data.lastName, 'Last name', 60);
        data.role = (0, validation_1.choice)(data.role || 'CUSTOMER', 'Account type', ['CUSTOMER', 'HOST', 'DEALER']);
        if (data.phone) {
            data.phone = this.msg91.normalizePhone((0, validation_1.text)(data.phone, 'Phone', 20));
        }
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    ...(data.phone ? [{ phone: data.phone }, { phone: data.phone.slice(1) }] : []),
                ],
            },
        });
        if (existing) {
            throw new common_1.ConflictException('User with this email or phone already exists');
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        const otpCode = String((0, node_crypto_1.randomInt)(100000, 999999));
        const otpCodeHash = this.isMsg91() ? null : this.sha256(otpCode);
        const otpExpiresAt = this.isMsg91() ? null : new Date(Date.now() + 10 * 60 * 1000);
        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                phone: data.phone,
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role || 'CUSTOMER',
                passwordHash,
                otpCodeHash,
                otpExpiresAt,
                wallet: {
                    create: {
                        balance: 0.0,
                    },
                },
                profile: {
                    create: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        city: data.city ? String(data.city).slice(0, 80) : 'Ahmedabad',
                        state: 'Gujarat',
                    },
                },
            },
            include: {
                wallet: true,
                profile: true,
            },
        });
        if (this.isMsg91()) {
            await this.msg91.sendOtp(user.phone);
        }
        else if (this.exposeDevOtp()) {
            console.log(`[SAFAR OTP] Mobile Verification OTP for ${user.phone || user.email}: ${otpCode}`);
        }
        const payload = { id: user.id, email: user.email, role: user.role };
        const token = this.jwtService.sign(payload);
        return {
            user: this.sanitizeUser(user),
            token,
            devOtp: this.exposeDevOtp() ? otpCode : undefined,
        };
    }
    async login(data) {
        data.email = (0, validation_1.text)(data.email, 'Email', 254).toLowerCase();
        if (typeof data.password !== 'string' || Buffer.byteLength(data.password) > 72)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const user = await this.prisma.user.findUnique({
            where: { email: data.email },
            include: { wallet: true, profile: true },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.isBlocked)
            throw new common_1.UnauthorizedException('This account is blocked. Contact Safar support.');
        const isMatch = await bcrypt.compare(data.password, user.passwordHash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { id: user.id, email: user.email, role: user.role };
        const token = this.jwtService.sign(payload);
        return { user: this.sanitizeUser(user), token };
    }
    async requestLoginOtp(phoneInput) {
        const phone = this.msg91.normalizePhone((0, validation_1.text)(phoneInput, 'Phone', 20));
        const user = await this.findByPhone(phone);
        if (user && !user.isBlocked) {
            if (this.isMsg91()) {
                await this.msg91.sendOtp(phone);
                await this.prisma.user.update({ where: { id: user.id }, data: { phone } });
            }
            else {
                const code = String((0, node_crypto_1.randomInt)(100000, 999999));
                await this.prisma.user.update({ where: { id: user.id }, data: { phone, otpCodeHash: this.sha256(code), otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
                return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600, devOtp: this.exposeDevOtp() ? code : undefined };
            }
        }
        return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600 };
    }
    async loginWithOtp(phoneInput, otpInput) {
        const phone = this.msg91.normalizePhone((0, validation_1.text)(phoneInput, 'Phone', 20));
        const code = String(otpInput || '').trim();
        if (!/^\d{6}$/.test(code))
            throw new common_1.BadRequestException('Enter a valid 6-digit OTP');
        const user = await this.findByPhone(phone);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid or expired OTP code. Please try again.');
        if (user.isBlocked)
            throw new common_1.UnauthorizedException('This account is blocked. Contact Safar support.');
        if (this.isMsg91()) {
            await this.msg91.verifyOtp(phone, code);
        }
        else {
            const valid = (user.otpCodeHash && user.otpExpiresAt && new Date(user.otpExpiresAt) > new Date() && user.otpCodeHash === this.sha256(code)) || (this.exposeDevOtp() && code === '123456');
            if (!valid)
                throw new common_1.BadRequestException('Invalid or expired OTP code. Please try again.');
        }
        const updated = await this.prisma.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: new Date(), otpCodeHash: null, otpExpiresAt: null }, include: { wallet: true, profile: true } });
        const token = this.jwtService.sign({ id: updated.id, email: updated.email, role: updated.role });
        return { user: this.sanitizeUser(updated), token };
    }
    maskPhone(phone) {
        return phone.length > 4 ? `${phone.slice(0, 3)}•••••${phone.slice(-4)}` : phone;
    }
    async sendOtp(userId, phoneInput) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        let phone = user.phone;
        if (phoneInput) {
            phone = this.msg91.normalizePhone((0, validation_1.text)(phoneInput, 'Phone', 20));
        }
        if (!phone)
            throw new common_1.BadRequestException('Please provide a mobile number to receive OTP');
        if (this.isMsg91()) {
            await this.msg91.sendOtp(phone);
            await this.prisma.user.update({ where: { id: userId }, data: { phone, otpCodeHash: null, otpExpiresAt: null } });
            return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600 };
        }
        const otpCode = String((0, node_crypto_1.randomInt)(100000, 999999));
        const otpCodeHash = this.sha256(otpCode);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.prisma.user.update({
            where: { id: userId },
            data: { phone, otpCodeHash, otpExpiresAt },
        });
        if (this.exposeDevOtp())
            console.log(`[SAFAR OTP] Sent 6-digit OTP to ${phone}: ${otpCode}`);
        const maskedPhone = this.maskPhone(phone);
        return {
            sent: true,
            maskedPhone,
            expiresInSeconds: 600,
            devOtp: this.exposeDevOtp() ? otpCode : undefined,
        };
    }
    async verifyOtp(userId, otpInput) {
        const code = String(otpInput || '').trim();
        if (!/^[0-9]{6}$/.test(code))
            throw new common_1.BadRequestException('Enter a valid 6-digit OTP');
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true, profile: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        if (this.isMsg91()) {
            await this.msg91.verifyOtp(user.phone || '', code);
            const updated = await this.prisma.user.update({
                where: { id: userId },
                data: { phoneVerifiedAt: new Date(), otpCodeHash: null, otpExpiresAt: null },
                include: { wallet: true, profile: true },
            });
            return { verified: true, user: this.sanitizeUser(updated) };
        }
        const isUniversalTestOtp = this.exposeDevOtp() && code === '123456';
        const isStoredOtpValid = user.otpCodeHash &&
            user.otpExpiresAt &&
            new Date(user.otpExpiresAt) > new Date() &&
            user.otpCodeHash === this.sha256(code);
        if (!isStoredOtpValid && !isUniversalTestOtp) {
            throw new common_1.BadRequestException('Invalid or expired OTP code. Please try again.');
        }
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                phoneVerifiedAt: new Date(),
                otpCodeHash: null,
                otpExpiresAt: null,
            },
            include: { wallet: true, profile: true },
        });
        return {
            verified: true,
            user: this.sanitizeUser(updated),
        };
    }
    async validateUser(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { wallet: true, profile: true },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        if (user.isBlocked)
            throw new common_1.UnauthorizedException('This account is blocked. Contact Safar support.');
        return this.sanitizeUser(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        msg91_service_1.Msg91Service])
], AuthService);
//# sourceMappingURL=auth.service.js.map