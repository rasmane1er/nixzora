import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminOrderListQuery,
  AdminOrderListQuerySchema,
  type CheckoutRequest,
  CheckoutRequestSchema,
  type CheckoutResponse,
  type OrderFulfillment,
  OrderFulfillmentSchema,
  type OrderSummary,
  type OrderView,
  type PagedResult,
  type PaymentSession,
  type AdminReturnQuery,
  AdminReturnQuerySchema,
  type RefundRequest,
  RefundRequestSchema,
  type ReturnCreate,
  ReturnCreateSchema,
  type ReturnDecision,
  ReturnDecisionSchema,
  type ReturnView,
  type SellerRatingCreate,
  SellerRatingCreateSchema,
} from '@nixzora/validation';
import { type Locale } from '@nixzora/i18n';
import { type Request } from 'express';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ReqLocale } from '../../common/locale';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import {
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  RequirePermissions,
} from '../identity/guards/decorators';
import { FakeGateway } from '../payments/fake.gateway';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/payment-gateway';
import { type OrderRow } from './order-links';
import { OrdersService } from './orders.service';
import { ReturnsService } from './returns.service';
import { SellerRatingsService } from './seller-ratings.service';

const ORDER_NUMBER = /^NX-[A-Z0-9]{6}$/;
const TokenQuery = z.object({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});
const FakeConfirmSchema = z.object({
  clientSecret: z.string().min(10).max(200),
  outcome: z.enum(['succeeded', 'failed', 'canceled', 'disputed']),
  /** What Stripe Radar would say about the card (fraud review tests). */
  riskLevel: z.enum(['normal', 'elevated', 'highest']).optional(),
});

function orderNumber(value: string): string {
  if (!ORDER_NUMBER.test(value)) throw new BadRequestException('That is not an order number.');
  return value;
}

@ApiTags('checkout')
@Controller({ version: '1' })
export class CheckoutController {
  constructor(
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
    private readonly ratings: SellerRatingsService,
  ) {}

  /** Creates the order and a payment session. Totals are always recomputed here. */
  @Post('checkout')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(CheckoutRequestSchema)
  checkout(
    @Body(new ZodValidationPipe(CheckoutRequestSchema)) body: CheckoutRequest,
    @MaybeUser() user: AuthUser | undefined,
    @ReqMeta() meta: RequestMeta,
    @ReqLocale() locale: Locale,
  ): Promise<CheckoutResponse> {
    return this.orders.checkout(body, user, meta, locale);
  }

  /** Order status page: the owner's session, or the signed link from the receipt. */
  @Get('orders/:number')
  @OptionalAuth()
  @ApiQuery({ name: 'token', required: false })
  async order(
    @Param('number') number: string,
    @Query(new ZodValidationPipe(TokenQuery)) query: z.infer<typeof TokenQuery>,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<OrderView> {
    return this.orders.view(await this.find(orderNumber(number), query.token, user));
  }

  /** Payment form for an unpaid order (e.g. after a reload or a declined card). */
  @Post('orders/:number/payment')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'token', required: false })
  async payment(
    @Param('number') number: string,
    @Query(new ZodValidationPipe(TokenQuery)) query: z.infer<typeof TokenQuery>,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<PaymentSession> {
    return this.orders.paymentSession(await this.find(orderNumber(number), query.token, user));
  }

  /** Start a return (delivered orders, within 30 days). */
  @Post('orders/:number/returns')
  @OptionalAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiQuery({ name: 'token', required: false })
  @ApiZodBody(ReturnCreateSchema)
  async requestReturn(
    @Param('number') number: string,
    @Query(new ZodValidationPipe(TokenQuery)) query: z.infer<typeof TokenQuery>,
    @MaybeUser() user: AuthUser | undefined,
    @Body(new ZodValidationPipe(ReturnCreateSchema)) body: ReturnCreate,
  ): Promise<ReturnView> {
    return this.returns.request(await this.find(orderNumber(number), query.token, user), body);
  }

  @Get('orders/:number/returns')
  @OptionalAuth()
  @ApiQuery({ name: 'token', required: false })
  async listReturns(
    @Param('number') number: string,
    @Query(new ZodValidationPipe(TokenQuery)) query: z.infer<typeof TokenQuery>,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<ReturnView[]> {
    const order = await this.find(orderNumber(number), query.token, user);
    return this.returns.forOrder(order.id);
  }

  /** Rate a delivered seller shipment 1–5 (or change the rating). Returns the updated order. */
  @Post('orders/:number/seller-ratings')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiQuery({ name: 'token', required: false })
  @ApiZodBody(SellerRatingCreateSchema)
  async rateSeller(
    @Param('number') number: string,
    @Query(new ZodValidationPipe(TokenQuery)) query: z.infer<typeof TokenQuery>,
    @MaybeUser() user: AuthUser | undefined,
    @Body(new ZodValidationPipe(SellerRatingCreateSchema)) body: SellerRatingCreate,
  ): Promise<OrderView> {
    const order = await this.find(orderNumber(number), query.token, user);
    await this.ratings.rate(order, body);
    return this.orders.view(await this.find(order.number, query.token, user));
  }

  private async find(
    number: string,
    token: string | undefined,
    user: AuthUser | undefined,
  ): Promise<OrderRow> {
    if (token) return this.orders.byNumberForGuest(number, token);
    if (user) return this.orders.byNumberForUser(number, user.id);
    throw new BadRequestException('Open the link from your confirmation email, or sign in.');
  }
}

@ApiTags('account')
@ApiBearerAuth()
@Controller({ path: 'me/orders', version: '1' })
export class AccountOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('orders.read.own')
  list(@CurrentUser() user: AuthUser): Promise<OrderSummary[]> {
    return this.orders.listForUser(user.id);
  }

  @Get(':number')
  @RequirePermissions('orders.read.own')
  async get(@CurrentUser() user: AuthUser, @Param('number') number: string): Promise<OrderView> {
    return this.orders.view(await this.orders.byNumberForUser(orderNumber(number), user.id));
  }
}

@ApiTags('payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /** Stripe → NIXZORA. Signature-verified; duplicates are acknowledged and ignored. */
  @Post('webhooks/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; result: string }> {
    if (this.gateway.name !== 'STRIPE') throw new ForbiddenException('Stripe is not enabled.');
    if (!req.rawBody) throw new BadRequestException('Missing body.');
    const event = this.gateway.parseWebhook(req.rawBody, signature);
    const result = event ? await this.orders.applyPaymentEvent(event) : 'ignored';
    return { received: true, result };
  }

  /** Development only: what "Pay" does when no real payment provider is configured. */
  @Post('fake/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(FakeConfirmSchema)
  async fakeConfirm(
    @Body(new ZodValidationPipe(FakeConfirmSchema)) body: z.infer<typeof FakeConfirmSchema>,
  ): Promise<{ status: string }> {
    if (!(this.gateway instanceof FakeGateway))
      throw new ForbiddenException('Test payments are off.');
    const paymentId = body.clientSecret.split('_secret_')[0] ?? '';
    const amount = await this.orders.paymentAmount(paymentId);
    if (body.riskLevel) this.gateway.setPaymentRisk(paymentId, body.riskLevel);
    const event = this.gateway.event(
      body.clientSecret,
      body.outcome,
      amount.amountCents,
      amount.currency,
    );
    await this.orders.applyPaymentEvent(event);
    return { status: body.outcome };
  }
}

@ApiTags('admin · orders')
@ApiBearerAuth()
@Controller({ path: 'admin/orders', version: '1' })
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
  ) {}

  @Post(':id/refunds')
  @RequirePermissions('orders.refund')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(RefundRequestSchema)
  refund(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RefundRequestSchema)) body: RefundRequest,
    @Actor() actor: ActorContext,
  ): Promise<OrderView> {
    return this.orders.partialRefund(id, body, actor);
  }

  @Get(':id/returns')
  @RequirePermissions('orders.read.all')
  orderReturns(@Param('id', new ParseUUIDPipe()) id: string): Promise<ReturnView[]> {
    return this.returns.forOrder(id);
  }

  @Get()
  @RequirePermissions('orders.read.all')
  list(
    @Query(new ZodValidationPipe(AdminOrderListQuerySchema)) query: AdminOrderListQuery,
  ): Promise<PagedResult<OrderSummary & { email: string }>> {
    return this.orders.listForAdmin(query);
  }

  @Get(':id')
  @RequirePermissions('orders.read.all')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.byIdForAdmin(id);
  }

  @Post(':id/fulfillment')
  @RequirePermissions('orders.fulfill')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(OrderFulfillmentSchema)
  fulfill(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(OrderFulfillmentSchema)) body: OrderFulfillment,
    @Actor() actor: ActorContext,
  ): Promise<OrderView> {
    return this.orders.fulfill(id, body, actor);
  }
}

@ApiTags('admin · orders')
@ApiBearerAuth()
@Controller({ path: 'admin/returns', version: '1' })
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermissions('orders.read.all')
  list(
    @Query(new ZodValidationPipe(AdminReturnQuerySchema)) query: AdminReturnQuery,
  ): Promise<ReturnView[]> {
    return this.returns.list(query.status);
  }

  @Post(':id/decision')
  @RequirePermissions('orders.fulfill')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ReturnDecisionSchema)
  decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ReturnDecisionSchema)) body: ReturnDecision,
    @Actor() actor: ActorContext,
  ): Promise<ReturnView> {
    return this.returns.decide(id, body, actor);
  }
}
