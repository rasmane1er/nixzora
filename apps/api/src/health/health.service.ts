import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type DependencyCheck, type HealthResponse } from '@nixzora/validation';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CHECK_TIMEOUT_MS = 1500;

async function timed(probe: () => Promise<unknown>): Promise<DependencyCheck> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS} ms`)),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      error: (error as Error).message.split('\n')[0],
    };
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      timed(() => this.prisma.$queryRaw`SELECT 1`),
      timed(() => this.redis.client.ping()),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      service: 'nixzora-api',
      version: this.config.get('APP_VERSION', { infer: true }),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }
}
