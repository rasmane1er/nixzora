import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type DeleteAccountRequest,
  DeleteAccountRequestSchema,
  type MfaCodeRequest,
  MfaCodeRequestSchema,
  type MfaEnabledResponse,
  MfaEnabledResponseSchema,
  type MfaSetupResponse,
  MfaSetupResponseSchema,
  SessionSummarySchema,
  type SessionSummary,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from './auth-user';
import { CurrentUser, RequirePermissions } from './guards/decorators';
import { AuthService } from './services/auth.service';
import { MfaService } from './services/mfa.service';
import { SessionService } from './services/session.service';

/** Self-service security settings: signed-in devices and two-step verification. */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me', version: '1' })
export class AccountController {
  constructor(
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  /** Deletes the caller's account after re-checking the password. Signs out everywhere. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(5))
  @ApiZodBody(DeleteAccountRequestSchema)
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(DeleteAccountRequestSchema)) body: DeleteAccountRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.auth.deleteAccount(user, body, meta);
  }

  @Get('sessions')
  @ApiZodResponse(z.array(SessionSummarySchema))
  async listSessions(@CurrentUser() user: AuthUser): Promise<SessionSummary[]> {
    const sessions = await this.sessions.listActive(user.id);
    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      current: session.id === user.sessionId,
      mfaVerified: session.mfaVerifiedAt !== null,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    if (!(await this.sessions.revoke(id, user.id))) {
      throw new NotFoundException('That device is not signed in.');
    }
    await this.audit.record({
      action: 'auth.session.revoked',
      actorId: user.id,
      entityType: 'session',
      entityId: id,
      meta,
    });
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOtherSessions(
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    const count = await this.sessions.revokeAllForUser(user.id, user.sessionId);
    await this.audit.record({
      action: 'auth.session.revoked_others',
      actorId: user.id,
      meta,
      metadata: { count },
    });
  }

  @Post('mfa/setup')
  @ApiZodResponse(
    MfaSetupResponseSchema,
    201,
    'Scan otpauthUrl as a QR code, then confirm with a code.',
  )
  startMfa(@CurrentUser() user: AuthUser): Promise<MfaSetupResponse> {
    return this.mfa.startSetup(user.id);
  }

  @Post('mfa/enable')
  @Throttle(perMinute(10))
  @ApiZodBody(MfaCodeRequestSchema)
  @ApiZodResponse(
    MfaEnabledResponseSchema,
    201,
    'Show these recovery codes once; they are not retrievable later.',
  )
  enableMfa(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(MfaCodeRequestSchema)) body: MfaCodeRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MfaEnabledResponse> {
    return this.mfa.confirmSetup(user.id, user.sessionId, body.code, meta);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(10))
  @ApiZodBody(MfaCodeRequestSchema)
  disableMfa(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(MfaCodeRequestSchema)) body: MfaCodeRequest,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.mfa.disable(user.id, body.code, meta);
  }
}
