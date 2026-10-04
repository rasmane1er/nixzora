import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type SupportReply,
  SupportReplySchema,
  type SupportRequestCreate,
  SupportRequestCreateSchema,
} from '@nixzora/validation';
import { type Locale } from '@nixzora/i18n';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ReqLocale } from '../../common/locale';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { perHour } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import {
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  RequirePermissions,
} from '../identity/guards/decorators';
import { SupportService } from './support.service';

const StatusQuery = z.object({ status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).optional() });

@ApiTags('support')
@Controller({ version: '1' })
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** Contact us / Report a problem. Signed out too, with an email address. */
  @Post('support/requests')
  @OptionalAuth()
  @Throttle(perHour(5))
  @ApiZodBody(SupportRequestCreateSchema)
  create(
    @Body(new ZodValidationPipe(SupportRequestCreateSchema)) body: SupportRequestCreate,
    @MaybeUser() user: AuthUser | undefined,
    @ReqLocale() locale: Locale,
  ) {
    return this.support.create(body, user, locale);
  }

  @Get('me/support-requests')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  mine(@CurrentUser() user: AuthUser) {
    return this.support.forUser(user.id);
  }
}

/** Ops Center: the support inbox. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('support.manage')
@Controller({ path: 'admin/support', version: '1' })
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Query(new ZodValidationPipe(StatusQuery)) query: z.infer<typeof StatusQuery>) {
    return this.support.list(query.status);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.support.get(id);
  }

  @Post(':id/reply')
  @ApiZodBody(SupportReplySchema)
  reply(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(SupportReplySchema)) body: SupportReply,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.support.reply(id, body, { user, meta });
  }
}
