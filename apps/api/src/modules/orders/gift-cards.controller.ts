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
import { type Locale } from '@nixzora/i18n';
import {
  type AdminGiftCardView,
  type CheckoutResponse,
  type GiftBalanceView,
  type GiftCardPurchase,
  GiftCardPurchaseSchema,
  type GiftCardRedeem,
  GiftCardRedeemSchema,
  type GiftCreditGrant,
  GiftCreditGrantSchema,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ReqLocale } from '../../common/locale';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { GiftCardsService } from './gift-cards.service';

const AdminQuery = z.object({ q: z.string().trim().max(100).optional() });

/** Buying e-gift cards (p10-10): signed in, paid by card. */
@ApiTags('gift cards')
@ApiBearerAuth()
@Controller({ path: 'gift-cards', version: '1' })
export class GiftCardsController {
  constructor(private readonly gifts: GiftCardsService) {}

  @Post('checkout')
  @Throttle(perMinute(10))
  @ApiZodBody(GiftCardPurchaseSchema)
  checkout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GiftCardPurchaseSchema)) body: GiftCardPurchase,
    @ReqMeta() meta: RequestMeta,
    @ReqLocale() locale: Locale,
  ): Promise<CheckoutResponse> {
    return this.gifts.purchase(user, body, meta, locale);
  }
}

/** The account's gift card balance: redeem codes, see what was added and spent. */
@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me/gift-cards', version: '1' })
export class AccountGiftCardsController {
  constructor(private readonly gifts: GiftCardsService) {}

  @Get()
  balance(@CurrentUser() user: AuthUser): Promise<GiftBalanceView> {
    return this.gifts.balance(user.id);
  }

  /** Few tries a minute: codes can't be guessed by trying. */
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  @ApiZodBody(GiftCardRedeemSchema)
  redeem(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GiftCardRedeemSchema)) body: GiftCardRedeem,
    @ReqMeta() meta: RequestMeta,
  ): Promise<GiftBalanceView> {
    return this.gifts.redeem(user, body.code, meta);
  }
}

/** Ops Center: look up gift cards; credit a customer's balance (goodwill). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class AdminGiftCardsController {
  constructor(private readonly gifts: GiftCardsService) {}

  @Get('gift-cards')
  @RequirePermissions('orders.read.all')
  list(@Query(new ZodValidationPipe(AdminQuery)) query: z.infer<typeof AdminQuery>) {
    return this.gifts.adminList(query) satisfies Promise<AdminGiftCardView[]>;
  }

  @Get('users/:id/gift-balance')
  @RequirePermissions('orders.read.all')
  userBalance(@Param('id', new ParseUUIDPipe()) id: string): Promise<GiftBalanceView> {
    return this.gifts.balance(id);
  }

  @Post('users/:id/gift-credit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('orders.refund')
  @ApiZodBody(GiftCreditGrantSchema)
  grant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(GiftCreditGrantSchema)) body: GiftCreditGrant,
    @Actor() actor: ActorContext,
  ): Promise<GiftBalanceView> {
    return this.gifts.grant(actor, id, body);
  }
}
