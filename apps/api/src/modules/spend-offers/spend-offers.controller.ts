import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type SpendOfferCreate, SpendOfferCreateSchema } from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { SpendOffersService } from './spend-offers.service';

const uuid = new ParseUUIDPipe();
const body = new ZodValidationPipe(SpendOfferCreateSchema);

/** Live Spend more, save more offers (p10-31), for the Deals page. */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog/spend-offers', version: '1' })
export class SpendOffersController {
  constructor(private readonly offers: SpendOffersService) {}

  @Get()
  live() {
    return this.offers.live();
  }
}

/** A store's spend tiers on everything it sells. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/spend-offers', version: '1' })
export class SellerSpendOffersController {
  constructor(
    private readonly offers: SpendOffersService,
    private readonly prisma: PrismaService,
  ) {}

  private async sellerId(actor: ActorContext, write = false): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: actor.user.id },
      select: { sellerId: true, role: true, seller: { select: { status: true } } },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    if (write && member.seller.status !== 'ACTIVE') {
      throw new ForbiddenException('Your store needs to be approved before it can run offers.');
    }
    if (write && !['OWNER', 'STAFF'].includes(member.role)) {
      throw new ForbiddenException('Your role can’t change offers.');
    }
    return member.sellerId;
  }

  @Get()
  async list(@Actor() actor: ActorContext) {
    return this.offers.list(await this.sellerId(actor));
  }

  @Post()
  @ApiZodBody(SpendOfferCreateSchema)
  async create(@Body(body) input: SpendOfferCreate, @Actor() actor: ActorContext) {
    return this.offers.create(input, actor, await this.sellerId(actor, true));
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async end(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.offers.end(id, actor, await this.sellerId(actor, true));
  }
}

/** Ops Center: every store's offers; NIXZORA's own are made here. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/spend-offers', version: '1' })
export class SpendOffersAdminController {
  constructor(private readonly offers: SpendOffersService) {}

  @Get()
  list() {
    return this.offers.list(undefined);
  }

  @Post()
  @ApiZodBody(SpendOfferCreateSchema)
  create(@Body(body) input: SpendOfferCreate, @Actor() actor: ActorContext) {
    return this.offers.create(input, actor, null);
  }

  /** Staff can end any offer, a store's included. */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  end(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.offers.end(id, actor, null);
  }
}
