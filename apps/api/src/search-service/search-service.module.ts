import {
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { type Env, validateEnv } from '../config/env';
import { SearchCoreModule } from '../modules/search/search-core.module';
import { SearchEngine } from '../modules/search/search-engine';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { InternalKeyGuard } from './internal-key.guard';
import { SearchServiceController } from './search-service.controller';

/** Load balancer / ECS health check: the database answers. */
@Controller()
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'search' };
  }
}

/** On start, embeds whatever changed while the service was down (one task at a time). */
@Injectable()
class StartupReindex implements OnApplicationBootstrap {
  private readonly logger = new Logger('SearchService');

  constructor(
    private readonly engine: SearchEngine,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    void this.engine
      .reindexAll()
      .then((r) => {
        if (!r.skipped)
          this.logger.log(`Search index: ${r.updated} of ${r.scanned} products updated`);
      })
      .catch((error: Error) => this.logger.error(`Search reindex failed: ${error.message}`));
  }
}

/**
 * The search service (ADR-0015): keyword + semantic retrieval and indexing, deployed on its own
 * so embedding work and search traffic scale apart from the API. Same code and image as the
 * API, started with dist/search-main.js.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          redact: ['req.headers["x-internal-key"]'],
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    SearchCoreModule,
  ],
  controllers: [SearchServiceController, HealthController],
  providers: [InternalKeyGuard, StartupReindex],
})
export class SearchServiceModule {}
