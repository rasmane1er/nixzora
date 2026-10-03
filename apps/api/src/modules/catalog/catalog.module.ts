import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SearchModule } from '../search/search.module';
import { CatalogAdminController } from './catalog-admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [MediaModule, SearchModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [CatalogQueryService, CatalogAdminService],
  exports: [CatalogQueryService, CatalogAdminService],
})
export class CatalogModule {}
