import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { text, choice } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
    data.email = text(data.email, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new BadRequestException('Invalid email');
    if (typeof data.password !== 'string' || data.password.length < 12 || Buffer.byteLength(data.password) > 72) throw new BadRequestException('Password must be 12–72 bytes');
    data.firstName = text(data.firstName, 'First name', 60);
    data.lastName = text(data.lastName, 'Last name', 60);
    data.role = choice(data.role || 'CUSTOMER', 'Account type', ['CUSTOMER', 'HOST', 'DEALER']);
    if (data.phone) {
      data.phone = text(data.phone, 'Phone', 16).replace(/[\s-]/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(data.phone)) throw new BadRequestException('Invalid phone');
    }
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('User with this email or phone already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'CUSTOMER',
        passwordHash,
        wallet: {
          create: {
            balance: 0.0,
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    const { passwordHash: _, ...result } = user;
    return { user: result, token };
  }

  async login(data: any) {
    data.email = text(data.email, 'Email', 254).toLowerCase();
    if (typeof data.password !== 'string' || Buffer.byteLength(data.password) > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { wallet: true },
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

    const { passwordHash: _, ...result } = user;
    return { user: result, token };
  }

  async validateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isBlocked) throw new UnauthorizedException('This account is blocked. Contact Safar support.');
    const { passwordHash: _, ...result } = user;
    return result;
  }
}
