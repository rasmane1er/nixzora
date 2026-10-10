import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { type Locale } from '@nixzora/i18n';
import {
  type SubscribeResult,
  type SubscriptionCreate,
  SubscriptionCreateSchema,
  type SubscriptionUpdate,
  SubscriptionUpdateSchema,
  type SubscriptionView,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ReqLocale } from '../../common/locale';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser } from '../identity/guards/decorators';
import { SubscriptionsService } from './subscriptions.service';

const uuid = new ParseUUIDPipe();
const SubscribableSchema = z.object({ allowed: z.boolean() });

/** Subscribe & Save (p10-11): the customer's subscriptions. */
@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me/subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<SubscriptionView[]> {
    return this.subscriptions.list(user.id);
  }

  /** Subscribes and places the first delivery now, on the default saved card. */
  @Post()
  @Throttle(perMinute(10))
  @ApiZodBody(SubscriptionCreateSchema)
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SubscriptionCreateSchema)) body: SubscriptionCreate,
    @ReqMeta() meta: RequestMeta,
    @ReqLocale() locale: Locale,
  ): Promise<SubscribeResult> {
    return this.subscriptions.subscribe(user, body, meta, locale);
  }

  @Patch(':id')
  @ApiZodBody(SubscriptionUpdateSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(SubscriptionUpdateSchema)) body: SubscriptionUpdate,
  ): Promise<SubscriptionView> {
    return this.subscriptions.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    return this.subscriptions.cancel(user.id, id);
  }
}

/** A store allows Subscribe & Save on one of its listings (and funds the discount). */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/products', version: '1' })
export class SellerSubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/subscribable')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(SubscribableSchema)
  async set(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(SubscribableSchema)) body: z.infer<typeof SubscribableSchema>,
  ): Promise<{ allowed: boolean }> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: user.id },
      select: { sellerId: true },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    return { allowed: await this.subscriptions.setSubscribable(member.sellerId, id, body.allowed) };
  }
}
