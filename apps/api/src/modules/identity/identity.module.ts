import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AuthController } from './auth.controller';
import { PasskeySignInController, PasskeysController } from './passkeys.controller';
import { AuthService } from './services/auth.service';
import { DeviceSignInService } from './services/device-sign-in.service';
import { LoginThrottleService } from './services/login-throttle.service';
import { MfaService } from './services/mfa.service';
import { PasskeyService } from './services/passkey.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { SocialIdentityService } from './services/social-identity.service';
import { TokenService } from './services/token.service';

@Module({
  controllers: [AuthController, AccountController, PasskeySignInController, PasskeysController],
  providers: [
    AuthService,
    DeviceSignInService,
    LoginThrottleService,
    MfaService,
    PasskeyService,
    PasswordService,
    SessionService,
    SocialIdentityService,
    TokenService,
  ],
  exports: [TokenService, SessionService],
})
export class IdentityModule {}
