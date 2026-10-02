import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../identity/guards/decorators';
import { SearchIndexService } from './search-index.service';

/** Ops Center: search index health and a manual rebuild. */
@ApiTags('admin')
@RequirePermissions('catalog.write')
@Controller({ path: 'admin/search', version: '1' })
export class SearchAdminController {
  constructor(private readonly index: SearchIndexService) {}

  @Get('stats')
  stats() {
    return this.index.stats();
  }

  /** Re-embeds changed products, or every product with ?force=true (e.g. after a model change). */
  @Post('reindex')
  @HttpCode(200)
  reindex(@Query('force') force?: string) {
    return this.index.reindexAll({ force: force === 'true' });
  }
}
