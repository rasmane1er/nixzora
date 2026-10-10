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
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ClipCouponCreate, ClipCouponCreateSchema } from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import {
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  RequirePermissions,
} from '../identity/guards/decorators';
import { ClipCouponsService } from './clip-coupons.service';

const uuid = new ParseUUIDPipe();

/** Clip coupons for shoppers (p10-18). */
@ApiTags('catalog')
@Controller({ version: '1' })
export class ClipCouponsController {
  constructor(private readonly coupons: ClipCouponsService) {}

  /** The coupons page; `clipped` lists the signed-in shopper's. */
  @Get('catalog/coupons')
  @OptionalAuth()
  page(@MaybeUser() user: AuthUser | undefined) {
    return this.coupons.page(user?.id);
  }

  @Get('me/coupons/clipped')
  clipped(@CurrentUser() user: AuthUser) {
    return this.coupons.clippedIds(user.id);
  }

  @Post('me/coupons/:id/clip')
  @HttpCode(HttpStatus.OK)
  clip(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.coupons.clip(user.id, id);
  }

  @Delete('me/coupons/:id/clip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unclip(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string): Promise<void> {
    await this.coupons.unclip(user.id, id);
  }
}

/** A store's coupons on its own listings. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/coupons', version: '1' })
export class SellerClipCouponsController {
  constructor(
    private readonly coupons: ClipCouponsService,
    private readonly prisma: PrismaService,
  ) {}

  private async sellerId(actor: ActorContext): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: actor.user.id },
      select: { sellerId: true, seller: { select: { status: true } } },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    if (member.seller.status !== 'ACTIVE') {
      throw new ForbiddenException('Your store needs to be approved before it can offer coupons.');
    }
    return member.sellerId;
  }

  @Get()
  async list(@Actor() actor: ActorContext) {
    return this.coupons.list(await this.sellerId(actor));
  }

  @Post()
  @ApiZodBody(ClipCouponCreateSchema)
  async create(
    @Body(new ZodValidationPipe(ClipCouponCreateSchema)) body: ClipCouponCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.coupons.create(body, actor, await this.sellerId(actor));
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async end(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.coupons.end(id, actor, await this.sellerId(actor));
  }
}

/** Ops Center: every clip coupon; NIXZORA's own are made here. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/clip-coupons', version: '1' })
export class ClipCouponsAdminController {
  constructor(private readonly coupons: ClipCouponsService) {}

  @Get()
  list() {
    return this.coupons.list(undefined);
  }

  @Post()
  @ApiZodBody(ClipCouponCreateSchema)
  create(
    @Body(new ZodValidationPipe(ClipCouponCreateSchema)) body: ClipCouponCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.coupons.create(body, actor, null);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  end(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.coupons.end(id, actor, null);
  }
}
