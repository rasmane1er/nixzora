import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { LoginThrottleService } from './services/login-throttle.service';
import { MfaService } from './services/mfa.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';

@Module({
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    LoginThrottleService,
    MfaService,
    PasswordService,
    SessionService,
    TokenService,
  ],
  exports: [TokenService, SessionService],
})
export class IdentityModule {}
