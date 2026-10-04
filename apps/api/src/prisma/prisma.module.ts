import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ReadDatabase } from './read-database';

@Global()
@Module({
  providers: [PrismaService, ReadDatabase],
  exports: [PrismaService, ReadDatabase],
})
export class PrismaModule {}
