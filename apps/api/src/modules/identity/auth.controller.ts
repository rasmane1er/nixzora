import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthTokens,
  AuthTokensSchema,
  type ChangePasswordRequest,
  ChangePasswordRequestSchema,
  type ForgotPasswordRequest,
  ForgotPasswordRequestSchema,
  type LoginRequest,
  LoginRequestSchema,
  type LoginResponse,
  LoginResponseSchema,
  type MeResponse,
  MeResponseSchema,
  type MfaChallengeRequest,
  MfaChallengeRequestSchema,
  type RefreshRequest,
  RefreshRequestSchema,
  type RegisterRequest,
  RegisterRequestSchema,
  type ResetPasswordRequest,
  ResetPasswordRequestSchema,
  type SocialProvidersResponse,
  SocialProvidersResponseSchema,
  type SocialSignInRequest,
  SocialSignInRequestSchema,
  type TokenRequest,
  TokenRequestSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from './auth-user';
import { CurrentUser, Public } from './guards/decorators';
import { AuthService } from './services/auth.service';
import { SocialIdentityService } from './services/social-identity.service';

// Tighter per-IP limits on endpoints attackers target (on top of the global limit).
const STRICT = { default: { limit: 5, ttl: 60_000 } };
const SIGN_IN = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly social: SocialIdentityService,
  ) {}

  @Public()
  @Post('register')
  @Throttle(STRICT)
  @ApiZodBody(RegisterRequestSchema)
  @ApiZodResponse(AuthTokensSchema, 201, 'Account created and signed in.')
  register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthTokens> {
    return this.auth.register(body, meta);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(SIGN_IN)
  @ApiZodBody(LoginRequestSchema)
  @ApiZodResponse(
    LoginResponseSchema,
    200,
    'Tokens, or an MFA challenge when two-step verification is on.',
  )
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LoginResponse> {
    return this.auth.login(body, meta);
  }

  @Public()
  @Get('social/providers')
  @ApiZodResponse(SocialProvidersResponseSchema, 200, 'Which sign-in buttons to show.')
  socialProviders(): SocialProvidersResponse {
    return this.social.providers();
  }

  @Public()
  @Post('social')
  @HttpCode(HttpStatus.OK)
  @Throttle(SIGN_IN)
  @ApiZodBody(SocialSignInRequestSchema)
  @ApiZodResponse(
    LoginResponseSchema,
    200,
    'Signs in (or signs up) with a Google or Apple ID token. MFA challenge when two-step is on.',
  )
  socialSignIn(
    @Body(new ZodValidationPipe(SocialSignInRequestSchema)) body: SocialSignInRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LoginResponse> {
    return this.auth.socialSignIn(body, meta);
  }

  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle(SIGN_IN)
  @ApiZodBody(MfaChallengeRequestSchema)
  @ApiZodResponse(AuthTokensSchema)
  completeMfa(
    @Body(new ZodValidationPipe(MfaChallengeRequestSchema)) body: MfaChallengeRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthTokens> {
    return this.auth.completeMfaChallenge(body.mfaToken, body.code, meta);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodBody(RefreshRequestSchema)
  @ApiZodResponse(AuthTokensSchema, 200, 'New access token and a new (rotated) refresh token.')
  refresh(
    @Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken, meta);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  logout(@CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta): Promise<void> {
    return this.auth.logout(user, meta);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiZodBody(TokenRequestSchema)
  verifyEmail(
    @Body(new ZodValidationPipe(TokenRequestSchema)) body: TokenRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.auth.verifyEmail(body.token, meta);
  }

  @Post('email/verify/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(STRICT)
  @ApiBearerAuth()
  resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.resendEmailVerification(user);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(STRICT)
  @ApiZodBody(ForgotPasswordRequestSchema)
  forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) body: ForgotPasswordRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.auth.forgotPassword(body.email, meta);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(STRICT)
  @ApiZodBody(ResetPasswordRequestSchema)
  resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: ResetPasswordRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.auth.resetPassword(body.token, body.newPassword, meta);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiZodBody(ChangePasswordRequestSchema)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.auth.changePassword(user, body, meta);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiZodResponse(MeResponseSchema)
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id, user);
  }
}
