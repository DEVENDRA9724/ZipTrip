import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Msg91Service } from './msg91.service';

const JWT_DEFAULT_SECRET = 'safar_prod_secret_351c1e91b0523198494d608ccd28bf2f79068a792b21321135dbd0d423d6d042';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const s = process.env.JWT_SECRET;
        const secret = (s && s.length >= 32 && !s.startsWith('replace-')) ? s : JWT_DEFAULT_SECRET;
        return {
          secret,
          signOptions: { expiresIn: '8h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, Msg91Service],
  exports: [AuthService, JwtAuthGuard, Msg91Service],
})
export class AuthModule {}
