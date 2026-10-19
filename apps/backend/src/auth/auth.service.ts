import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { text, choice } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { Msg91Service } from './msg91.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private msg91: Msg91Service,
  ) {}

  private sha256(val: string) {
    return createHash('sha256').update(String(val)).digest('hex');
  }

  private isMsg91() {
    return this.msg91.isEnabled();
  }

  private exposeDevOtp() {
    return process.env.NODE_ENV !== 'production' && !this.isMsg91() && process.env.OTP_PROVIDER !== 'live';
  }

  private async findByPhone(phone: string) {
    const normalized = this.msg91.normalizePhone(phone);
    const candidates = [normalized, normalized.slice(1)];
    return this.prisma.user.findFirst({
      where: { OR: candidates.map(value => ({ phone: value })) },
      include: { wallet: true, profile: true },
    });
  }

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash: _p, otpCodeHash: _o, ...rest } = user;
    return rest;
  }

  async register(data: any) {
    data.email = text(data.email, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new BadRequestException('Invalid email');
    if (typeof data.password !== 'string' || data.password.length < 8 || Buffer.byteLength(data.password) > 72) {
      throw new BadRequestException('Password must be 8–72 characters');
    }
    data.firstName = text(data.firstName, 'First name', 60);
    data.lastName = text(data.lastName, 'Last name', 60);
    data.role = choice(data.role || 'CUSTOMER', 'Account type', ['CUSTOMER', 'HOST', 'DEALER']);
    if (data.phone) {
      data.phone = this.msg91.normalizePhone(text(data.phone, 'Phone', 20));
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
      throw new ConflictException('User with this email or phone already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const otpCode = String(randomInt(100000, 999999));
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
      await this.msg91.sendOtp(user.phone!);
    } else if (this.exposeDevOtp()) {
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

  async login(data: any) {
    data.email = text(data.email, 'Email', 254).toLowerCase();
    if (typeof data.password !== 'string' || Buffer.byteLength(data.password) > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { wallet: true, profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.isBlocked) throw new UnauthorizedException('This account is blocked. Contact Safar support.');

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return { user: this.sanitizeUser(user), token };
  }

  async requestLoginOtp(phoneInput: string) {
    const phone = this.msg91.normalizePhone(text(phoneInput, 'Phone', 20));
    const user = await this.findByPhone(phone);
    // Keep the response generic so an attacker cannot enumerate registered
    // phone numbers. Verification still requires an existing, unblocked user.
    if (user && !user.isBlocked) {
      if (this.isMsg91()) {
        await this.msg91.sendOtp(phone);
        await this.prisma.user.update({ where: { id: user.id }, data: { phone } });
      } else {
        const code = String(randomInt(100000, 999999));
        await this.prisma.user.update({ where: { id: user.id }, data: { phone, otpCodeHash: this.sha256(code), otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
        return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600, devOtp: this.exposeDevOtp() ? code : undefined };
      }
    }
    return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600 };
  }

  async loginWithOtp(phoneInput: string, otpInput: string) {
    const phone = this.msg91.normalizePhone(text(phoneInput, 'Phone', 20));
    const code = String(otpInput || '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Enter a valid 6-digit OTP');
    const user = await this.findByPhone(phone);
    if (!user) throw new UnauthorizedException('Invalid or expired OTP code. Please try again.');
    if (user.isBlocked) throw new UnauthorizedException('This account is blocked. Contact Safar support.');

    if (this.isMsg91()) {
      await this.msg91.verifyOtp(phone, code);
    } else {
      const valid = (user.otpCodeHash && user.otpExpiresAt && new Date(user.otpExpiresAt) > new Date() && user.otpCodeHash === this.sha256(code)) || (this.exposeDevOtp() && code === '123456');
      if (!valid) throw new BadRequestException('Invalid or expired OTP code. Please try again.');
    }
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: new Date(), otpCodeHash: null, otpExpiresAt: null }, include: { wallet: true, profile: true } });
    const token = this.jwtService.sign({ id: updated.id, email: updated.email, role: updated.role });
    return { user: this.sanitizeUser(updated), token };
  }

  private maskPhone(phone: string) {
    return phone.length > 4 ? `${phone.slice(0, 3)}•••••${phone.slice(-4)}` : phone;
  }

  async sendOtp(userId: string, phoneInput?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    let phone = user.phone;
    if (phoneInput) {
      phone = this.msg91.normalizePhone(text(phoneInput, 'Phone', 20));
    }
    if (!phone) throw new BadRequestException('Please provide a mobile number to receive OTP');

    if (this.isMsg91()) {
      await this.msg91.sendOtp(phone);
      await this.prisma.user.update({ where: { id: userId }, data: { phone, otpCodeHash: null, otpExpiresAt: null } });
      return { sent: true, maskedPhone: this.maskPhone(phone), expiresInSeconds: 600 };
    }

    const otpCode = String(randomInt(100000, 999999));
    const otpCodeHash = this.sha256(otpCode);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, otpCodeHash, otpExpiresAt },
    });

    if (this.exposeDevOtp()) console.log(`[SAFAR OTP] Sent 6-digit OTP to ${phone}: ${otpCode}`);
    const maskedPhone = this.maskPhone(phone);

    return {
      sent: true,
      maskedPhone,
      expiresInSeconds: 600,
      devOtp: this.exposeDevOtp() ? otpCode : undefined,
    };
  }

  async verifyOtp(userId: string, otpInput: string) {
    const code = String(otpInput || '').trim();
    if (!/^[0-9]{6}$/.test(code)) throw new BadRequestException('Enter a valid 6-digit OTP');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, profile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

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
    const isStoredOtpValid =
      user.otpCodeHash &&
      user.otpExpiresAt &&
      new Date(user.otpExpiresAt) > new Date() &&
      user.otpCodeHash === this.sha256(code);

    if (!isStoredOtpValid && !isUniversalTestOtp) {
      throw new BadRequestException('Invalid or expired OTP code. Please try again.');
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

  async validateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true, profile: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isBlocked) throw new UnauthorizedException('This account is blocked. Contact Safar support.');
    return this.sanitizeUser(user);
  }
}
