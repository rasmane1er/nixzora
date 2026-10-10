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
import { Throttle } from '@nestjs/throttler';
import {
  type AdCampaignCreate,
  AdCampaignCreateSchema,
  type AdCampaignSuspend,
  AdCampaignSuspendSchema,
  type AdCampaignUpdate,
  AdCampaignUpdateSchema,
  type AdClick,
  type AdClickResult,
  AdClickSchema,
  type AdCreditGrant,
  AdCreditGrantSchema,
  type AdQuery,
  AdQuerySchema,
  type SponsoredProducts,
  SponsoredProductsSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { MaybeUser, OptionalAuth, RequirePermissions } from '../identity/guards/decorators';
import { AdCampaignsService } from './ad-campaigns.service';
import { AdsService } from './ads.service';

const uuid = new ParseUUIDPipe();

/** Sponsored products on the storefront and in the app (p10-01). */
@ApiTags('ads')
@Controller({ path: 'ads', version: '1' })
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  /** Ads for a search, a category, a product page or the home page; often none. */
  @OptionalAuth()
  @Get()
  @ApiZodResponse(SponsoredProductsSchema)
  serve(
    @Query(new ZodValidationPipe(AdQuerySchema)) query: AdQuery,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<SponsoredProducts> {
    return this.ads.serve(query, { userId: user?.id, visitorId: query.visitorId });
  }

  /** The shopper opened an ad: returns the product to show. */
  @OptionalAuth()
  @Post('clicks')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(30))
  @ApiZodBody(AdClickSchema)
  async click(
    @Body(new ZodValidationPipe(AdClickSchema)) body: AdClick,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<AdClickResult> {
    const { slug } = await this.ads.click(body.token, {
      userId: user?.id,
      visitorId: body.visitorId,
    });
    return { slug };
  }
}

/** The seller portal's Ads page. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/ads', version: '1' })
export class SellerAdsController {
  constructor(private readonly campaigns: AdCampaignsService) {}

  @Get()
  overview(@Actor() actor: ActorContext) {
    return this.campaigns.overview(actor);
  }

  @Post('campaigns')
  @ApiZodBody(AdCampaignCreateSchema)
  create(
    @Body(new ZodValidationPipe(AdCampaignCreateSchema)) body: AdCampaignCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.campaigns.create(body, actor);
  }

  @Patch('campaigns/:id')
  @ApiZodBody(AdCampaignUpdateSchema)
  update(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(AdCampaignUpdateSchema)) body: AdCampaignUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.campaigns.update(id, body, actor);
  }
}

/** Ops Center: review campaigns, stop one that breaks the rules, grant ad credit. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/ads', version: '1' })
export class AdsAdminController {
  constructor(private readonly campaigns: AdCampaignsService) {}

  @Get('campaigns')
  list(@Query('status') status: string | undefined) {
    return this.campaigns.list(status);
  }

  /** Approved stores, with their ad credit, for "Grant ad credit". */
  @Get('sellers')
  sellers() {
    return this.campaigns.sellersWithCredit();
  }

  @Post('campaigns/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(AdCampaignSuspendSchema)
  suspend(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(AdCampaignSuspendSchema)) body: AdCampaignSuspend,
    @Actor() actor: ActorContext,
  ) {
    return this.campaigns.suspend(id, body.reason, actor);
  }

  @Post('campaigns/:id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.campaigns.restore(id, actor);
  }

  @Post('sellers/:id/credit')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(AdCreditGrantSchema)
  grantCredit(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(AdCreditGrantSchema)) body: AdCreditGrant,
    @Actor() actor: ActorContext,
  ) {
    return this.campaigns.grantCredit(id, body, actor);
  }
}
