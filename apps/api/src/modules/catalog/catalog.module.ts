import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogController } from './catalog.controller';
import { SearchHelpService } from './search-help.service';
import { Spelling } from './spelling';

@Module({
  imports: [MediaModule, SearchModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogQueryService, CatalogAdminService, SearchHelpService, Spelling],
  exports: [CatalogQueryService, CatalogAdminService],
})
export class CatalogModule {}
