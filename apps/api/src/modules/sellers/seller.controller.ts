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
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type InventoryAdjust,
  type ListingImportRequest,
  ListingImportRequestSchema,
  InventoryAdjustSchema,
  type PayoutOnboardingLink,
  PayoutOnboardingLinkSchema,
  type ProductImageAttach,
  ProductImageAttachSchema,
  type ProductImageOrder,
  ProductImageOrderSchema,
  type SellerApplication,
  SellerHandleSchema,
  type SellerApplicationDraft,
  SellerApplicationDraftSchema,
  SellerApplicationSchema,
  type SellerBrandingUpload,
  SellerBrandingUploadSchema,
  type SellerAnalyticsQuery,
  SellerAnalyticsQuerySchema,
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
import { type Response } from 'express';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { PayoutsService } from './payouts.service';
import { SellerAnalyticsService } from './seller-analytics.service';
import { SellerFeedbackService } from './seller-feedback.service';
import { SellerImportService } from './seller-import.service';
import { SellerListingsService } from './seller-listings.service';
import { SellerOnboardingService } from './seller-onboarding.service';
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
    private readonly payouts: PayoutsService,
    private readonly applications: SellerOnboardingService,
    private readonly imports: SellerImportService,
    private readonly analytics: SellerAnalyticsService,
    private readonly feedback: SellerFeedbackService,
  ) {}

  /** Ratings with their private comments, and return requests that include this store's items. */
  @Get('feedback')
  feedbackView(@Actor() actor: ActorContext) {
    return this.feedback.forSeller(actor);
  }

  @Get('analytics')
  sellerAnalytics(
    @Query(new ZodValidationPipe(SellerAnalyticsQuerySchema)) query: SellerAnalyticsQuery,
    @Actor() actor: ActorContext,
  ) {
    return this.analytics.forSeller(query.days, actor);
  }

  // Bulk listings (CSV). Declared before products/:id so these paths are not read as ids.
  @Get('products/import/template')
  template(@Res() res: Response) {
    res.type('text/csv').attachment('nixzora-listings-template.csv').send(this.imports.template());
  }

  @Get('products/export')
  async export(@Actor() actor: ActorContext, @Res() res: Response) {
    const csv = await this.imports.exportCsv(actor);
    res.type('text/csv').attachment('nixzora-listings.csv').send(csv);
  }

  @Post('products/import')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ListingImportRequestSchema)
  importListings(
    @Body(new ZodValidationPipe(ListingImportRequestSchema)) body: ListingImportRequest,
    @Actor() actor: ActorContext,
  ) {
    return this.imports.run(body, actor);
  }

  @Get('payouts')
  payoutsList(@Query('page') page: string | undefined, @Actor() actor: ActorContext) {
    return this.payouts.listForSeller(actor, Math.min(500, Math.max(1, Number(page) || 1)));
  }

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

  // Onboarding (p8-13)
  /** `{ draft: null }` when the caller has nothing saved. */
  @Get('application')
  async application(@Actor() actor: ActorContext) {
    return { draft: await this.applications.draft(actor.user.id) };
  }

  @Put('application')
  @ApiZodBody(SellerApplicationDraftSchema)
  saveApplication(
    @Body(new ZodValidationPipe(SellerApplicationDraftSchema)) body: SellerApplicationDraft,
    @Actor() actor: ActorContext,
  ) {
    return this.applications.saveDraft(actor.user.id, body);
  }

  @Delete('application')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discardApplication(@Actor() actor: ActorContext): Promise<void> {
    await this.applications.discardDraft(actor.user.id);
  }

  /** Whether a store address is still free, with a free variant to suggest when it is not. */
  @Get('handle-available')
  handleAvailable(@Query('handle', new ZodValidationPipe(SellerHandleSchema)) handle: string) {
    return this.sellers.handleAvailability(handle);
  }

  /** Logo or banner, for the application or the store settings. */
  @Post('branding/upload')
  @ApiZodBody(SellerBrandingUploadSchema)
  brandingUpload(
    @Body(new ZodValidationPipe(SellerBrandingUploadSchema)) body: SellerBrandingUpload,
  ) {
    return this.applications.brandingUpload(body);
  }

  @Post('apply')
  @ApiZodBody(SellerApplicationSchema)
  @ApiZodResponse(SellerViewSchema, 201)
  apply(
    @Body(new ZodValidationPipe(SellerApplicationSchema)) body: SellerApplication,
    @Actor() actor: ActorContext,
  ) {
    return this.applications.apply(body, actor);
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

  @Post('products/:id/copy-suggestion')
  @HttpCode(HttpStatus.OK)
  suggestCopy(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.listings.suggestCopy(id, actor);
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

  /** Reordering approved photos is not new content, so a live listing stays live. */
  @Put('products/:id/images/order')
  @ApiZodBody(ProductImageOrderSchema)
  reorderImages(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ProductImageOrderSchema)) body: ProductImageOrder,
    @Actor() actor: ActorContext,
  ) {
    return this.listings.reorderImages(id, body, actor);
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
