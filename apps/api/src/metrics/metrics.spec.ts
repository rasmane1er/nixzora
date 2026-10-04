import express from 'express';
import request from 'supertest';
import {
  httpMetricsMiddleware,
  httpRequests,
  registry,
  replicaLag,
  replicaUsable,
  scrapeHooks,
  timeDependency,
} from './metrics';

describe('metrics', () => {
  beforeEach(() => registry.resetMetrics());

  it('records requests by route pattern and status class, never by raw URL', async () => {
    const app = express();
    app.use(httpMetricsMiddleware);
    app.get('/api/v1/products/:slug', (_req, res) => void res.json({ ok: true }));
    app.get('/api/v1/health', (_req, res) => void res.json({ ok: true }));
    await request(app).get('/api/v1/products/vela-15').expect(200);
    await request(app).get('/api/v1/products/kestrel-14').expect(200);
    await request(app).get('/nowhere').expect(404);
    await request(app).get('/api/v1/health').expect(200);

    const { values } = await httpRequests.get();
    const counts = values
      .filter((v) => v.metricName === 'nixzora_http_request_duration_seconds_count')
      .map((v) => [v.labels.route, v.labels.status, v.value]);
    expect(counts).toEqual(
      expect.arrayContaining([
        ['/api/v1/products/:slug', '2xx', 2],
        ['unmatched', '4xx', 1],
      ]),
    );
    expect(counts.some(([route]) => String(route).includes('health'))).toBe(false);
  });

  it('times dependency calls and counts failures, including HTTP error responses', async () => {
    await timeDependency('search', 'POST /internal/search/hybrid', async () => ({ ok: true }));
    await timeDependency('voyage', 'embeddings', async () => ({ ok: false }));
    await expect(
      timeDependency('ai', '/explain', async () => {
        throw new Error('timeout');
      }),
    ).rejects.toThrow('timeout');
    const text = await registry.metrics();
    expect(text).toMatch(
      /nixzora_dependency_request_duration_seconds_count\{[^}]*dependency="search"[^}]*outcome="ok"[^}]*\} 1/,
    );
    expect(text).toMatch(/dependency="voyage"[^}]*outcome="error"/);
    expect(text).toMatch(/dependency="ai"[^}]*outcome="error"/);
  });
});

describe('replica gauges', () => {
  it('report nothing until a replica is configured', async () => {
    scrapeHooks.replica = undefined;
    replicaLag.reset();
    replicaUsable.reset();
    const text = await registry.metrics();
    expect(text).not.toMatch(/^nixzora_db_replica_(lag_seconds|usable)\{/m);
    replicaUsable.set({ replica: 'read' }, 0);
    expect(await registry.metrics()).toMatch(
      /^nixzora_db_replica_usable\{[^}]*replica="read"[^}]*\} 0/m,
    );
  });
});
