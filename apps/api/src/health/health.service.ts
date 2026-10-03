import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type DependencyCheck, type HealthResponse, type JobsCheck } from '@nixzora/validation';
import { type Env } from '../config/env';
import { OutboxService } from '../modules/outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CHECK_TIMEOUT_MS = 1500;
/** The outbox is drained every 3 s; a minute without a run means the jobs have stalled. */
const JOBS_STALE_MS = 60_000;

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
    private readonly outbox: OutboxService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis, jobs] = await Promise.all([
      timed(() => this.prisma.$queryRaw`SELECT 1`),
      timed(() => this.redis.client.ping()),
      this.jobs(),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      service: 'nixzora-api',
      version: this.config.get('APP_VERSION', { infer: true }),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
      ...(jobs ? { jobs } : {}),
    };
  }

  /** Background jobs: informational, so a stalled worker never fails the API's health check. */
  async jobs(): Promise<JobsCheck | undefined> {
    try {
      const stats = await this.outbox.stats();
      const age = stats.lastRunAt ? Date.now() - Date.parse(stats.lastRunAt) : Infinity;
      return {
        // "inline": the API runs them itself; "worker": the notifications worker does.
        mode:
          process.env.NIXZORA_PROCESS !== 'worker' &&
          this.config.get('BACKGROUND_JOBS', { infer: true })
            ? 'inline'
            : 'worker',
        status: !stats.lastRunAt ? 'unknown' : age < JOBS_STALE_MS ? 'up' : 'down',
        ...stats,
      };
    } catch {
      return undefined;
    }
  }
}
