import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type CouponCreate,
  CouponCreateSchema,
  type CouponUpdate,
  CouponUpdateSchema,
  type CouponView,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { CouponsService } from './coupons.service';

@ApiTags('admin · promotions')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/coupons', version: '1' })
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(): Promise<CouponView[]> {
    return this.coupons.list();
  }

  @Post()
  @ApiZodBody(CouponCreateSchema)
  create(
    @Body(new ZodValidationPipe(CouponCreateSchema)) body: CouponCreate,
    @Actor() actor: ActorContext,
  ): Promise<CouponView> {
    return this.coupons.create(body, actor);
  }

  @Patch(':id')
  @ApiZodBody(CouponUpdateSchema)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CouponUpdateSchema)) body: CouponUpdate,
    @Actor() actor: ActorContext,
  ): Promise<CouponView> {
    return this.coupons.update(id, body, actor);
  }
}
