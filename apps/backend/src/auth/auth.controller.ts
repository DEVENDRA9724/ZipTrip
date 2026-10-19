import { Controller, Post, Get, Body, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private session(res: Response, result: any) {
    const isHttps = (process.env.WEB_ORIGIN || '').startsWith('https://');
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
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(res, await this.auth.register(body));
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(res, await this.auth.login(body));
  }

  @Post('login/otp/request')
  requestLoginOtp(@Body() body: any) {
    return this.auth.requestLoginOtp(body?.phone);
  }

  @Post('login/otp/verify')
  async verifyLoginOtp(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(res, await this.auth.loginWithOtp(body?.phone, body?.otp));
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('safar_session', { path: '/' });
    return { message: 'Signed out' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Request() req: any) {
    return this.auth.validateUser(req.user.id);
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
