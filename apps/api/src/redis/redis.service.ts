import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { type Env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.client.on('error', (error) => this.logger.debug(`Redis error: ${error.message}`));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Redis not reachable at startup: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
