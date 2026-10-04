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
import {
  type AdminRiskQuery,
  AdminRiskQuerySchema,
  type PagedResult,
  type RiskAssessmentView,
  type RiskReview,
  RiskReviewSchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { RiskService } from '../risk/risk.service';
import { OrdersService } from './orders.service';

/** Ops Center: orders and payouts held by fraud checks (ADR-0024). */
@ApiTags('admin · risk')
@ApiBearerAuth()
@Controller({ path: 'admin/risk', version: '1' })
export class AdminRiskController {
  constructor(
    private readonly risk: RiskService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  @RequirePermissions('risk.review')
  list(
    @Query(new ZodValidationPipe(AdminRiskQuerySchema)) query: AdminRiskQuery,
  ): Promise<PagedResult<RiskAssessmentView>> {
    return this.risk.list(query);
  }

  @Get(':id')
  @RequirePermissions('risk.review')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<RiskAssessmentView> {
    return this.risk.get(id);
  }

  /**
   * Clear (release the hold) or confirm fraud. Confirming a held order cancels and refunds it
   * first, so the reviewer needs the refund permission too; nothing is recorded if that fails.
   */
  @Post(':id/review')
  @RequirePermissions('risk.review')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(RiskReviewSchema)
  async review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(RiskReviewSchema)) body: RiskReview,
    @Actor() actor: ActorContext,
  ): Promise<RiskAssessmentView> {
    const current = await this.risk.get(id);
    const order = current.order;
    if (
      body.outcome === 'confirm' &&
      current.subject === 'CHECKOUT' &&
      order &&
      ['PENDING_PAYMENT', 'PAID', 'FULFILLING'].includes(order.status)
    ) {
      await this.orders.fulfill(
        order.id,
        { action: 'cancel', reason: 'Cancelled after a fraud review.' },
        actor,
      );
    }
    return this.risk.review(id, body, actor);
  }
}
