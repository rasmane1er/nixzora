import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type BudgetUpdate, BudgetUpdateSchema } from '@nixzora/validation';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { BudgetService } from './budget.service';

/** A customer's monthly budget (p10-35). */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/budget', version: '1' })
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.budget.get(user.id);
  }

  @Put()
  set(
    @Body(new ZodValidationPipe(BudgetUpdateSchema)) body: BudgetUpdate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.budget.set(user.id, body);
  }
}
