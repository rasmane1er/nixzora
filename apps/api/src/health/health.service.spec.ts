import { type ConfigService } from '@nestjs/config';
import { HealthResponseSchema } from '@nixzora/validation';
import { type Env } from '../config/env';
import { type PrismaService } from '../prisma/prisma.service';
import { type RedisService } from '../redis/redis.service';
import { HealthService } from './health.service';

function build(db: () => Promise<unknown>, ping: () => Promise<unknown>): HealthService {
  const prisma = { $queryRaw: db } as unknown as PrismaService;
  const redis = { client: { ping } } as unknown as RedisService;
  const config = { get: () => '0.1.0-test' } as unknown as ConfigService<Env, true>;
  return new HealthService(prisma, redis, config);
}

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
});
