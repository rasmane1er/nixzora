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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type DealCreate,
  DealCreateSchema,
  type DealListQuery,
  DealListQuerySchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { DealsService } from './deals.service';

const uuid = new ParseUUIDPipe();

/** Today's deals for shoppers (p10-07). */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog/deals', version: '1' })
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  page(@Query(new ZodValidationPipe(DealListQuerySchema)) query: DealListQuery) {
    return this.deals.page(query);
  }
}

/** A store's deals on its own products. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/deals', version: '1' })
export class SellerDealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly prisma: PrismaService,
  ) {}

  private async sellerId(actor: ActorContext): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: actor.user.id },
      select: { sellerId: true, seller: { select: { status: true } } },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    if (member.seller.status !== 'ACTIVE') {
      throw new ForbiddenException('Your store needs to be approved before it can run deals.');
    }
    return member.sellerId;
  }

  @Get()
  async list(@Actor() actor: ActorContext) {
    return this.deals.list({ sellerId: await this.sellerId(actor) });
  }

  @Post()
  @ApiZodBody(DealCreateSchema)
  async create(
    @Body(new ZodValidationPipe(DealCreateSchema)) body: DealCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.deals.create(body, actor, await this.sellerId(actor));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.deals.cancel(id, actor, await this.sellerId(actor));
  }
}

/** Ops Center: deals on any product. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/deals', version: '1' })
export class DealsAdminController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list() {
    return this.deals.list({});
  }

  @Post()
  @ApiZodBody(DealCreateSchema)
  create(
    @Body(new ZodValidationPipe(DealCreateSchema)) body: DealCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.deals.create(body, actor, null);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.deals.cancel(id, actor, null);
  }
}
