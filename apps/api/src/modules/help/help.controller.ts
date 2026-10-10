import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type Locale } from '@nixzora/i18n';
import {
  type HelpAction,
  HelpActionSchema,
  type HelpConversation,
  type HelpMessageCreate,
  HelpMessageCreateSchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ReqLocale } from '../../common/locale';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser } from '../identity/guards/decorators';
import { HelpService } from './help.service';

/** The help agent (p10-20): a support chat about the signed-in shopper's own orders. */
@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me/help', version: '1' })
export class HelpController {
  constructor(private readonly help: HelpService) {}

  /** The current conversation (just the welcome when there is none). */
  @Get()
  current(@CurrentUser() user: AuthUser, @ReqLocale() locale: Locale): Promise<HelpConversation> {
    return this.help.current(user.id, locale);
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(20))
  @ApiZodBody(HelpMessageCreateSchema)
  send(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(HelpMessageCreateSchema)) body: HelpMessageCreate,
    @ReqLocale() locale: Locale,
  ): Promise<HelpConversation> {
    return this.help.send(user, body.text, locale);
  }

  /** A button: cancel an order, choose one, or send the chat to the support team. */
  @Post('actions')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(10))
  @ApiZodBody(HelpActionSchema)
  act(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(HelpActionSchema)) body: HelpAction,
    @ReqLocale() locale: Locale,
  ): Promise<HelpConversation> {
    return this.help.act(user, body, locale);
  }

  /** Start over: the next message opens a new conversation. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async startOver(@CurrentUser() user: AuthUser): Promise<void> {
    await this.help.startOver(user.id);
  }
}
