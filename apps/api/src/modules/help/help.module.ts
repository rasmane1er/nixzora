import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrdersModule } from '../orders/orders.module';
import { SupportModule } from '../support/support.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

/** The help agent (p10-20, ADR-0042). */
@Module({
  imports: [AiModule, OrdersModule, SupportModule],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
