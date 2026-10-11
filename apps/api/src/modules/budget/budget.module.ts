import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

/** p10-35: a private monthly spending budget. */
@Module({
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
