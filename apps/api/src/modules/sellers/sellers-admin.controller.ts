import {
  Body,
  Controller,
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
  type AdminSellerListQuery,
  AdminSellerListQuerySchema,
  type AdminSellerStatusChange,
  AdminSellerStatusChangeSchema,
  type AdminSellerTerms,
  AdminSellerTermsSchema,
  AdminSellerViewSchema,
  type ListingReviewDecision,
  ListingReviewDecisionSchema,
  type ListingReviewQuery,
  ListingReviewQuerySchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { SellersAdminService } from './sellers-admin.service';

const uuid = new ParseUUIDPipe();

/** Ops Center: sellers (sellers.manage) and the listing review queue (catalog.write). */
@ApiTags('admin · sellers')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class SellersAdminController {
  constructor(private readonly admin: SellersAdminService) {}

  @Get('sellers')
  @RequirePermissions('sellers.manage')
  list(@Query(new ZodValidationPipe(AdminSellerListQuerySchema)) query: AdminSellerListQuery) {
    return this.admin.list(query);
  }

  @Get('sellers/:id')
  @RequirePermissions('sellers.manage')
  @ApiZodResponse(AdminSellerViewSchema)
  get(@Param('id', uuid) id: string) {
    return this.admin.get(id);
  }

  @Post('sellers/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sellers.manage')
  @ApiZodBody(AdminSellerStatusChangeSchema)
  changeStatus(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(AdminSellerStatusChangeSchema)) body: AdminSellerStatusChange,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.changeStatus(id, body, actor);
  }

  @Patch('sellers/:id')
  @RequirePermissions('sellers.manage')
  @ApiZodBody(AdminSellerTermsSchema)
  updateTerms(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(AdminSellerTermsSchema)) body: AdminSellerTerms,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.updateTerms(id, body, actor);
  }

  @Post('sellers/:id/payouts/refresh')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sellers.manage')
  refreshPayouts(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.admin.refreshPayouts(id, actor);
  }

  @Get('listings/review')
  @RequirePermissions('catalog.write')
  reviewQueue(@Query(new ZodValidationPipe(ListingReviewQuerySchema)) query: ListingReviewQuery) {
    return this.admin.reviewQueue(query);
  }

  @Post('listings/:id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('catalog.write')
  @ApiZodBody(ListingReviewDecisionSchema)
  decide(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ListingReviewDecisionSchema)) body: ListingReviewDecision,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.decide(id, body, actor);
  }
}
