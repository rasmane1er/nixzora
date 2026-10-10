import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import {
  MultiBuysAdminController,
  MultiBuysController,
  SellerMultiBuysController,
} from './multi-buys.controller';
import { MultiBuysService } from './multi-buys.service';

/** Buy X, get Y (ADR-0049). */
@Module({
  imports: [CatalogModule],
  controllers: [MultiBuysController, SellerMultiBuysController, MultiBuysAdminController],
  providers: [MultiBuysService],
})
export class MultiBuysModule {}
