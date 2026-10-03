import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { InsightsController } from './insights.controller';
import { ProductCopyService } from './product-copy.service';
import { ReviewInsightsService } from './review-insights.service';

/** p6-03 / p6-04: product copy suggestions and review insights ("what customers say"). */
@Module({
  imports: [AiModule],
  controllers: [InsightsController],
  providers: [ReviewInsightsService, ProductCopyService],
  exports: [ReviewInsightsService, ProductCopyService],
})
export class InsightsModule {}
