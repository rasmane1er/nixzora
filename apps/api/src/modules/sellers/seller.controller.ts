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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type InventoryAdjust,
  InventoryAdjustSchema,
  type PayoutOnboardingLink,
  PayoutOnboardingLinkSchema,
  type ProductImageAttach,
  ProductImageAttachSchema,
  type SellerApplication,
  SellerApplicationSchema,
  type SellerMeResponse,
  type SellerOrderListQuery,
  SellerOrderListQuerySchema,
  type SellerOrderShip,
  SellerOrderShipSchema,
  SellerMeResponseSchema,
  type SellerProductCreate,
  SellerProductCreateSchema,
  type SellerProductListQuery,
  SellerProductListQuerySchema,
  type SellerProductUpdate,
  SellerProductUpdateSchema,
  type SellerProfileUpdate,
  SellerProfileUpdateSchema,
  SellerViewSchema,
  type UploadRequest,
  UploadRequestSchema,
  type VariantCreate,
  VariantCreateSchema,
  type VariantUpdate,
  VariantUpdateSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { SellerListingsService } from './seller-listings.service';
import { SellerOrdersService } from './seller-orders.service';
import { SellersService } from './sellers.service';

const uuid = new ParseUUIDPipe();

/**
 * The seller portal API (p7-01 – p7-03). Any signed-in customer can apply; everything else
 * requires membership of a store and only ever touches that store's data.
 */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller', version: '1' })
export class SellerController {
  constructor(
    private readonly sellers: SellersService,
    private readonly listings: SellerListingsService,
    private readonly orders: SellerOrdersService,
  ) {}

  // Orders and earnings
  @Get('orders')
  sellerOrders(
    @Query(new ZodValidationPipe(SellerOrderListQuerySchema)) query: SellerOrderListQuery,
    @Actor() actor: ActorContext,
  ) {
    return this.orders.list(query, actor);
  }

  @Get('orders/:id')
  sellerOrder(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.orders.get(id, actor);
  }

  @Post('orders/:id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(SellerOrderShipSchema)
  ship(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(SellerOrderShipSchema)) body: SellerOrderShip,
    @Actor() actor: ActorContext,
  ) {
    return this.orders.ship(id, body, actor);
  }

  @Get('balance')
  balance(@Actor() actor: ActorContext) {
    return this.orders.balanceFor(actor);
  }

  @Get('ledger')
  ledger(@Query('page') page: string | undefined, @Actor() actor: ActorContext) {
    return this.orders.ledger(actor, Math.min(500, Math.max(1, Number(page) || 1)));
  }

  @Get('me')
  @ApiZodResponse(SellerMeResponseSchema)
  me(@Actor() actor: ActorContext): Promise<SellerMeResponse> {
    return this.sellers.me(actor.user.id);
  }

  @Post('apply')
  @ApiZodBody(SellerApplicationSchema)
  @ApiZodResponse(SellerViewSchema, 201)
  apply(
    @Body(new ZodValidationPipe(SellerApplicationSchema)) body: SellerApplication,
    @Actor() actor: ActorContext,
  ) {
    return this.sellers.apply(body, actor);
  }

  @Patch('me')
  @ApiZodBody(SellerProfileUpdateSchema)
  @ApiZodResponse(SellerViewSchema)
  update(
    @Body(new ZodValidationPipe(SellerProfileUpdateSchema)) body: SellerProfileUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.sellers.updateProfile(body, actor);
  }

  // Payouts
  @Post('payouts/onboarding')
  @ApiZodResponse(PayoutOnboardingLinkSchema, 201, 'Send the seller to this URL.')
  onboarding(@Actor() actor: ActorContext): Promise<PayoutOnboardingLink> {
    return this.sellers.startPayoutOnboarding(actor);
  }

  @Post('payouts/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiZodResponse(SellerViewSchema)
  refreshPayouts(@Actor() actor: ActorContext) {
    return this.sellers.refreshPayouts(actor);
  }

  // Listings
  @Get('products')
  products(
    @Query(new ZodValidationPipe(SellerProductListQuerySchema)) query: SellerProductListQuery,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.list(query, actor);
  }

  @Get('products/:id')
  product(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.listings.get(id, actor);
  }

  @Post('products')
  @ApiZodBody(SellerProductCreateSchema)
  create(
    @Body(new ZodValidationPipe(SellerProductCreateSchema)) body: SellerProductCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.create(body, actor);
  }

  @Patch('products/:id')
  @ApiZodBody(SellerProductUpdateSchema)
  updateProduct(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(SellerProductUpdateSchema)) body: SellerProductUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.update(id, body, actor);
  }

  @Post('products/:id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.listings.submit(id, actor);
  }

  @Post('products/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.listings.withdraw(id, actor);
  }

  @Post('products/:id/variants')
  @ApiZodBody(VariantCreateSchema)
  addVariant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VariantCreateSchema)) body: VariantCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.addVariant(id, body, actor);
  }

  @Patch('variants/:id')
  @ApiZodBody(VariantUpdateSchema)
  updateVariant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VariantUpdateSchema)) body: VariantUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.updateVariant(id, body, actor);
  }

  @Post('variants/:id/stock')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(InventoryAdjustSchema)
  adjustStock(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(InventoryAdjustSchema)) body: InventoryAdjust,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.adjustStock(id, body, actor);
  }

  // Photos: same two-step upload as the Ops Center, scoped to the seller's listings.
  @Post('uploads')
  @ApiZodBody(UploadRequestSchema)
  upload(
    @Body(new ZodValidationPipe(UploadRequestSchema)) body: UploadRequest,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.createUpload(body, actor);
  }

  @Post('products/:id/images')
  @ApiZodBody(ProductImageAttachSchema)
  attachImage(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ProductImageAttachSchema)) body: ProductImageAttach,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.attachImage(id, body, actor);
  }

  @Delete('products/:id/images/:imageId')
  removeImage(
    @Param('id', uuid) id: string,
    @Param('imageId', uuid) imageId: string,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.removeImage(id, imageId, actor);
  }
}
