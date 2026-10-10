import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminConversationView,
  type ConversationReport,
  ConversationReportSchema,
  type ConversationStart,
  ConversationStartSchema,
  type ConversationSummary,
  type ConversationView,
  type MessageSend,
  MessageSendSchema,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { MessagingService } from './messaging.service';

const uuid = new ParseUUIDPipe();
const CloseSchema = z.object({ closed: z.boolean() });
const ModerateSchema = z.object({ action: z.enum(['hide', 'restore', 'dismiss']) });
const AdminQuery = z.object({ reported: z.enum(['1', '0']).optional() });

/** A customer's messages with stores (p10-12). */
@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me/messages', version: '1' })
export class CustomerMessagesController {
  constructor(private readonly messages: MessagingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ConversationSummary[]> {
    return this.messages.mine(user.id);
  }

  /** Writes to a store, in an open thread on the same topic or a new one. */
  @Post()
  @Throttle(perMinute(10))
  @ApiZodBody(ConversationStartSchema)
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ConversationStartSchema)) body: ConversationStart,
  ): Promise<ConversationView> {
    return this.messages.start(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<ConversationView> {
    return this.messages.forCustomer(user.id, id);
  }

  @Post(':id')
  @Throttle(perMinute(20))
  @ApiZodBody(MessageSendSchema)
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(MessageSendSchema)) body: MessageSend,
  ): Promise<ConversationView> {
    return this.messages.customerReply(user.id, id, body.body);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ConversationReportSchema)
  report(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ConversationReportSchema)) body: ConversationReport,
  ): Promise<ConversationView> {
    return this.messages.report('customer', user.id, id, body.reason);
  }
}

/** A store's messages from customers, in the seller portal. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/messages', version: '1' })
export class SellerMessagesController {
  constructor(private readonly messages: MessagingService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ConversationSummary[]> {
    return this.messages.forSellerList(await this.messages.sellerOf(user.id));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
  ): Promise<ConversationView> {
    return this.messages.forSeller(await this.messages.sellerOf(user.id), id);
  }

  @Post(':id')
  @Throttle(perMinute(30))
  @ApiZodBody(MessageSendSchema)
  async reply(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(MessageSendSchema)) body: MessageSend,
  ): Promise<ConversationView> {
    return this.messages.sellerReply(await this.messages.sellerOf(user.id), user.id, id, body.body);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(CloseSchema)
  async close(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(CloseSchema)) body: z.infer<typeof CloseSchema>,
  ): Promise<ConversationView> {
    return this.messages.setClosed(await this.messages.sellerOf(user.id), id, body.closed);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ConversationReportSchema)
  async report(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ConversationReportSchema)) body: ConversationReport,
  ): Promise<ConversationView> {
    return this.messages.report('seller', await this.messages.sellerOf(user.id), id, body.reason);
  }
}

/** Ops Center: reported threads; hide what breaks the rules. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('support.manage')
@Controller({ path: 'admin/messages', version: '1' })
export class AdminMessagesController {
  constructor(private readonly messages: MessagingService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(AdminQuery)) query: z.infer<typeof AdminQuery>,
  ): Promise<AdminConversationView[]> {
    return this.messages.adminList(query.reported !== '0');
  }

  @Get(':id')
  get(@Param('id', uuid) id: string): Promise<AdminConversationView> {
    return this.messages.adminGet(id);
  }

  @Post(':id/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ModerateSchema)
  moderate(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ModerateSchema)) body: z.infer<typeof ModerateSchema>,
  ): Promise<AdminConversationView> {
    return this.messages.moderate(user.id, id, body.action);
  }
}
