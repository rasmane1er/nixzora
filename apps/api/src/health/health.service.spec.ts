import { type ConfigService } from '@nestjs/config';
import { HealthResponseSchema } from '@nixzora/validation';
import { type Env } from '../config/env';
import { type OutboxStreamer, type StreamStats } from '../modules/outbox/outbox-streamer';
import { type OutboxService, type OutboxStats } from '../modules/outbox/outbox.service';
import { type PrismaService } from '../prisma/prisma.service';
import { type RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';

function build(
  db: () => Promise<unknown>,
  ping: () => Promise<unknown>,
  stats: OutboxStats = { backlog: 0, failed: 0 },
  streamed: StreamStats = { enabled: false, backlog: 0 },
): HealthService {
  const prisma = { $queryRaw: db } as unknown as PrismaService;
  const redis = { client: { ping } } as unknown as RedisService;
  const config = {
    get: (key: string) => (key === 'BACKGROUND_JOBS' ? false : '0.1.0-test'),
  } as unknown as ConfigService<Env, true>;
  const outbox = { stats: () => Promise.resolve(stats) } as unknown as OutboxService;
  const streamer = { stats: () => Promise.resolve(streamed) } as unknown as OutboxStreamer;
  return new HealthService(prisma, redis, config, outbox, streamer);
}

const ok = () => Promise.resolve([{ '?column?': 1 }]);
const pong = () => Promise.resolve('PONG');

describe('HealthService', () => {
  it('reports ok when every dependency answers', async () => {
    const result = await build(
      () => Promise.resolve([{ '?column?': 1 }]),
      () => Promise.resolve('PONG'),
    ).check();

    expect(HealthResponseSchema.parse(result)).toBeTruthy();
    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
  });

  it('reports degraded with the reason when Redis is down', async () => {
    const result = await build(
      () => Promise.resolve([]),
      () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    ).check();

    expect(result.status).toBe('degraded');
    expect(result.checks.redis).toMatchObject({
      status: 'down',
      error: 'connect ECONNREFUSED 127.0.0.1:6379',
    });
  });

  it('reports the notifications worker without letting it fail the API', async () => {
    const fresh = await build(ok, pong, {
      backlog: 2,
      failed: 0,
      lastRunAt: new Date().toISOString(),
    }).check();
    expect(HealthResponseSchema.parse(fresh).jobs).toMatchObject({
      mode: 'worker',
      status: 'up',
      backlog: 2,
    });

    const stalled = await build(ok, pong, {
      backlog: 40,
      failed: 1,
      lastRunAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    }).check();
    expect(stalled.jobs?.status).toBe('down');
    expect(stalled.status).toBe('ok');

    const never = await build(ok, pong).check();
    expect(never.jobs?.status).toBe('unknown');
  });

  it('adds Kafka streaming when it is on', async () => {
    const off = await build(ok, pong).check();
    expect(off.jobs?.stream).toBeUndefined();

    const on = await build(
      ok,
      pong,
      { backlog: 0, failed: 0, lastRunAt: new Date().toISOString() },
      { enabled: true, backlog: 3, lastRunAt: new Date().toISOString() },
    ).check();
    expect(HealthResponseSchema.parse(on).jobs?.stream).toEqual({
      status: 'up',
      backlog: 3,
      lastRunAt: expect.any(String),
    });

    const waiting = await build(ok, pong, undefined, { enabled: true, backlog: 9 }).check();
    expect(waiting.jobs?.stream).toEqual({ status: 'unknown', backlog: 9 });
  });
});
