import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const cookie = request.headers.cookie?.split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith('safar_session='))?.slice(14);
    const authHeader = request.headers.authorization || (cookie ? `Bearer ${cookie}` : undefined);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header is missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, email: true, role: true, isBlocked: true } });
      if (!user) throw new UnauthorizedException();
      if (user.isBlocked) throw new UnauthorizedException('This account is blocked. Contact Safar support.');
      request.user = user;
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
