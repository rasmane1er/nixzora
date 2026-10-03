import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SearchEngine } from '../modules/search/search-engine';
import { InternalKeyGuard } from './internal-key.guard';

const HybridRequestSchema = z.object({
  q: z.string().trim().min(1).max(500),
  options: z
    .object({
      status: z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ARCHIVED']).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      minSimilarity: z.number().min(0).max(1).optional(),
      allowLoose: z.boolean().optional(),
    })
    .default({}),
});
type HybridRequest = z.infer<typeof HybridRequestSchema>;

/** The search service's private API (ADR-0015). Reachable only inside the VPC, with the key. */
@Controller('internal/search')
@UseGuards(InternalKeyGuard)
export class SearchServiceController {
  constructor(private readonly engine: SearchEngine) {}

  @Get('ready')
  async ready() {
    return { ready: await this.engine.isReady() };
  }

  @Post('hybrid')
  @HttpCode(200)
  async hybrid(@Body(new ZodValidationPipe(HybridRequestSchema)) body: HybridRequest) {
    const ranked = await this.engine.hybrid(body.q, body.options);
    return { results: [...ranked.entries()] };
  }

  @Post('index/:id')
  @HttpCode(200)
  async index(@Param('id', new ParseUUIDPipe()) id: string) {
    return { changed: await this.engine.indexProduct(id) };
  }

  @Post('reindex')
  @HttpCode(200)
  reindex(@Query('force') force?: string) {
    return this.engine.reindexAll({ force: force === 'true' });
  }

  @Get('stats')
  stats() {
    return this.engine.stats();
  }
}
