import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthTokens,
  AuthTokensSchema,
  type DeviceSignInCredential,
  DeviceSignInCredentialSchema,
  type DeviceSignInEnableRequest,
  DeviceSignInEnableRequestSchema,
  type DeviceSignInRequest,
  DeviceSignInRequestSchema,
  type DeviceSignInResponse,
  DeviceSignInResponseSchema,
  type DeviceSignInSummary,
  DeviceSignInSummarySchema,
  type PasskeyOptionsResponse,
  PasskeyOptionsResponseSchema,
  type PasskeyRegisterRequest,
  PasskeyRegisterRequestSchema,
  type PasskeyRenameRequest,
  PasskeyRenameRequestSchema,
  type PasskeySignInRequest,
  PasskeySignInRequestSchema,
  type PasskeySummary,
  PasskeySummarySchema,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from './auth-user';
import { CurrentUser, Public, RequirePermissions } from './guards/decorators';
import { DeviceSignInService } from './services/device-sign-in.service';
import { PasskeyService } from './services/passkey.service';

const SIGN_IN = { default: { limit: 10, ttl: 60_000 } };

/** Signing in with a passkey or with the app's Face ID / fingerprint sign-in (ADR-0019). */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class PasskeySignInController {
  constructor(
    private readonly passkeys: PasskeyService,
    private readonly devices: DeviceSignInService,
  ) {}

  @Public()
  @Post('passkey/options')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiZodResponse(PasskeyOptionsResponseSchema, 200, 'A challenge for navigator.credentials.get.')
  passkeyOptions(): Promise<PasskeyOptionsResponse> {
    return this.passkeys.signInOptions();
  }

  @Public()
  @Post('passkey')
  @HttpCode(HttpStatus.OK)
  @Throttle(SIGN_IN)
  @ApiZodBody(PasskeySignInRequestSchema)
  @ApiZodResponse(AuthTokensSchema, 200, 'Signed in. A passkey counts as two-step verification.')
  passkeySignIn(
    @Body(new ZodValidationPipe(PasskeySignInRequestSchema)) body: PasskeySignInRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AuthTokens> {
    return this.passkeys.signIn(body, meta);
  }

  @Public()
  @Post('device')
  @HttpCode(HttpStatus.OK)
  @Throttle(SIGN_IN)
  @ApiZodBody(DeviceSignInRequestSchema)
  @ApiZodResponse(DeviceSignInResponseSchema, 200, 'Signed in; the device secret is rotated.')
  deviceSignIn(
    @Body(new ZodValidationPipe(DeviceSignInRequestSchema)) body: DeviceSignInRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DeviceSignInResponse> {
    return this.devices.signIn(body, meta);
  }
}

/** The caller's passkeys and the phones with Face ID / fingerprint sign-in turned on. */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me', version: '1' })
export class PasskeysController {
  constructor(
    private readonly passkeys: PasskeyService,
    private readonly devices: DeviceSignInService,
  ) {}

  @Get('passkeys')
  @ApiZodResponse(z.array(PasskeySummarySchema))
  list(@CurrentUser() user: AuthUser): Promise<PasskeySummary[]> {
    return this.passkeys.list(user.id);
  }

  @Post('passkeys/options')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodResponse(
    PasskeyOptionsResponseSchema,
    200,
    'A challenge for navigator.credentials.create.',
  )
  registrationOptions(@CurrentUser() user: AuthUser): Promise<PasskeyOptionsResponse> {
    return this.passkeys.registrationOptions(user);
  }

  @Post('passkeys')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PasskeyRegisterRequestSchema)
  @ApiZodResponse(PasskeySummarySchema, 201)
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PasskeyRegisterRequestSchema)) body: PasskeyRegisterRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PasskeySummary> {
    return this.passkeys.register(user, body, meta);
  }

  @Patch('passkeys/:id')
  @ApiZodBody(PasskeyRenameRequestSchema)
  @ApiZodResponse(PasskeySummarySchema)
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PasskeyRenameRequestSchema)) body: PasskeyRenameRequest,
  ): Promise<PasskeySummary> {
    return this.passkeys.rename(user.id, id, body.name);
  }

  @Delete('passkeys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.passkeys.remove(user, id, meta);
  }

  @Get('device-sign-ins')
  @ApiZodResponse(z.array(DeviceSignInSummarySchema))
  listDevices(@CurrentUser() user: AuthUser): Promise<DeviceSignInSummary[]> {
    return this.devices.list(user.id);
  }

  @Post('device-sign-ins')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(DeviceSignInEnableRequestSchema)
  @ApiZodResponse(DeviceSignInCredentialSchema, 201, 'The device secret, shown only once.')
  enableDevice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(DeviceSignInEnableRequestSchema)) body: DeviceSignInEnableRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DeviceSignInCredential> {
    return this.devices.enable(user, body, meta);
  }

  @Delete('device-sign-ins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeDevice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.devices.revoke(user, id, meta);
  }
}
