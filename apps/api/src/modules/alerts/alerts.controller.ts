import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ProductAlertKind } from '@nixzora/validation';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { AlertsService } from './alerts.service';

const KindQuery = z.object({
  kind: z.enum(['BACK_IN_STOCK', 'PRICE_DROP']).default('BACK_IN_STOCK'),
});

/** A customer's back-in-stock and price-drop alerts (p10-06). */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/alerts', version: '1' })
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.alerts.list(user.id);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query(new ZodValidationPipe(KindQuery)) query: { kind: ProductAlertKind },
    @CurrentUser() user: AuthUser,
  ) {
    return this.alerts.subscribe(user.id, productId, query.kind);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query(new ZodValidationPipe(KindQuery)) query: { kind: ProductAlertKind },
    @CurrentUser() user: AuthUser,
  ) {
    return this.alerts.unsubscribe(user.id, productId, query.kind);
  }
}
