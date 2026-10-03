import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { configureApp } from '../src/app.setup';

// Requires PostgreSQL and Redis (pnpm db:up locally; service containers in CI).
describe('GET /api/v1/health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with a contract-valid body when PostgreSQL and Redis are up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    const body = HealthResponseSchema.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.redis.status).toBe('up');
  });

  it('reports the background jobs: last outbox run and what is waiting', async () => {
    await app.get(OutboxService).drain();
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const { jobs } = HealthResponseSchema.parse(res.body);
    expect(jobs).toMatchObject({ mode: 'inline', status: 'up' });
    expect(jobs?.failed).toBeGreaterThanOrEqual(0);
    expect(Date.now() - Date.parse(jobs!.lastRunAt!)).toBeLessThan(10_000);
  });

  it('sends security headers from helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('serves the OpenAPI document outside production', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(res.body.info.title).toBe('NIXZORA API');
  });
});
