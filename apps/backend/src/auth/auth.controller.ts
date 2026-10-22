import { Controller, Post, Get, Body, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { demoVerificationEnabled } from '../vehicles/vehicle-status';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private session(req: any, res: Response, result: any) {
    // Secure whenever the site is served over HTTPS: by the request itself, the proxy's first forwarded protocol, or the
    // configured public origin. Plain-HTTP access by IP (no HTTPS origin configured) still gets a working cookie.
    const forwarded = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const httpsOrigin = (process.env.WEB_ORIGIN || '').split(',').some(origin => origin.trim().startsWith('https://'));
    const isHttps = forwarded === 'https' || req?.secure === true || httpsOrigin;
    res.cookie('safar_session', result.token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000,
      path: '/',
    });
    // The browser uses the HttpOnly cookie; the native mobile client stores the
    // same short-lived JWT in its secure token store.
    return { user: result.user, token: result.token, devOtp: result.devOtp };
  }

  @Post('register')
  async register(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(req, res, await this.auth.register(body));
  }

  @Post('login')
  async login(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(req, res, await this.auth.login(body));
  }

  @Post('login/otp/request')
  requestLoginOtp(@Body() body: any) {
    return this.auth.requestLoginOtp(body?.phone);
  }

  @Post('login/otp/verify')
  async verifyLoginOtp(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(req, res, await this.auth.loginWithOtp(body?.phone, body?.otp));
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('safar_session', { path: '/' });
    return { message: 'Signed out' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Request() req: any) {
    const user = await this.auth.validateUser(req.user.id);
    // Lets the portal label demo records honestly while local demo mode is on.
    return user && demoVerificationEnabled() ? { ...user, demoVerification: true } : user;
  }

  @Post('otp/send')
  @UseGuards(JwtAuthGuard)
  sendOtp(@Request() req: any, @Body() body: any) {
    return this.auth.sendOtp(req.user.id, body?.phone);
  }

  @Post('otp/verify')
  @UseGuards(JwtAuthGuard)
  verifyOtp(@Request() req: any, @Body() body: any) {
    return this.auth.verifyOtp(req.user.id, body?.otp);
  }
}
