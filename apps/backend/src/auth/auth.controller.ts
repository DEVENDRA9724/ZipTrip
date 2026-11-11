import { Controller, Post, Get, Body, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private session(req: any, res: Response, result: any) {
    try {
      const isForwardedHttps = req?.headers?.['x-forwarded-proto'] === 'https';
      const isDirectHttps = req?.secure === true;
      const isHttps = isForwardedHttps || isDirectHttps;
      res.cookie('safar_session', result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: 8 * 3600 * 1000,
        path: '/',
      });
    } catch (e) {
      console.warn('[Session Cookie Warning]', e);
    }
    // The browser uses the HttpOnly cookie; the native mobile client stores the
    // same short-lived JWT in its secure token store.
    return { user: result.user, token: result.token, devOtp: result.devOtp };
  }

  @Post('register')
  async register(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    try {
      return this.session(req, res, await this.auth.register(body));
    } catch (err) {
      console.error('[Register Controller Error]', err);
      throw err;
    }
  }

  @Post('login')
  async login(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    try {
      return this.session(req, res, await this.auth.login(body));
    } catch (err) {
      console.error('[Login Controller Error]', err);
      throw err;
    }
  }

  @Post('login/otp/request')
  requestLoginOtp(@Body() body: any) {
    return this.auth.requestLoginOtp(body?.phone);
  }

  @Post('login/otp/verify')
  async verifyLoginOtp(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(req, res, await this.auth.loginWithOtp(body?.phone, body?.otp));
  }

  @Post('firebase/session')
  async loginWithFirebase(@Request() req: any, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.session(req, res, await this.auth.loginWithFirebase(body?.idToken));
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
