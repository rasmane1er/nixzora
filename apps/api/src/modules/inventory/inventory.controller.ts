import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type InventoryAdjust, InventoryAdjustSchema } from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { InventoryService, type StockRow } from './inventory.service';

const StockQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  lowStock: z.coerce.number().int().min(0).max(100_000).optional(),
});

@ApiTags('admin · inventory')
@ApiBearerAuth()
@RequirePermissions('inventory.write')
@Controller({ path: 'admin/inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'SKU or product title' })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description: 'Only rows with available ≤ this number',
  })
  list(
    @Query(new ZodValidationPipe(StockQuerySchema)) query: z.infer<typeof StockQuerySchema>,
  ): Promise<StockRow[]> {
    return this.inventory.list({ q: query.q, lowStockThreshold: query.lowStock });
  }

  @Post(':variantId/adjust')
  @ApiZodBody(InventoryAdjustSchema)
  adjust(
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body(new ZodValidationPipe(InventoryAdjustSchema)) body: InventoryAdjust,
    @Actor() actor: ActorContext,
  ): Promise<StockRow> {
    return this.inventory.adjust(variantId, body, actor);
  }
}
