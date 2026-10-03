import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.AI_DRIVER = 'local';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.SEARCH_MODE = 'hybrid';
process.env.INTERNAL_API_KEY = 'k'.repeat(48);

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { SearchEngine } from '../src/modules/search/search-engine';
import { SearchIndexService } from '../src/modules/search/search-index.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SearchServiceModule } from '../src/search-service/search-service.module';
import { removeTestData } from './cleanup';

/**
 * The API and the search service (ADR-0015) side by side, as on AWS: the storefront search goes
 * API → search service; catalog events re-index through it; and when the service is down the
 * API still answers with keyword search.
 */
describe('Search service (e2e)', () => {
  let service: INestApplication;
  let api: INestApplication;
  let prisma: PrismaService;
  let engine: SearchEngine;
  const run = Date.now().toString(36);
  const KEY = process.env.INTERNAL_API_KEY!;
  let productId: string;

  beforeAll(async () => {
    service = (
      await Test.createTestingModule({ imports: [SearchServiceModule] }).compile()
    ).createNestApplication({ logger: false });
    await service.listen(0, '127.0.0.1');
    const { port } = service.getHttpServer().address() as AddressInfo;
    engine = service.get(SearchEngine);

    process.env.SEARCH_SERVICE_URL = `http://127.0.0.1:${port}`;
    api = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication({ logger: false });
    configureApp(api);
    await api.init();
    prisma = api.get(PrismaService);

    const category = await prisma.category.create({
      data: { slug: `kites-${run}`, name: 'Kites' },
    });
    const product = await prisma.product.create({
      data: {
        slug: `aurora-stunt-kite-${run}`,
        title: `Aurora stunt kite ${run}`,
        description: 'A dual-line sport kite that loops and dives in light beach wind.',
        status: 'ACTIVE',
        categoryId: category.id,
        attributes: { span_cm: 210 },
        variants: {
          create: [
            {
              sku: `KITE-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 7_900,
              inventory: { create: { onHand: 3 } },
            },
          ],
        },
      },
    });
    productId = product.id;
  }, 30_000);

  afterAll(async () => {
    delete process.env.SEARCH_SERVICE_URL;
    await removeTestData(prisma, run);
    await api.close();
    service.getHttpServer().closeAllConnections();
    await service.close().catch(() => undefined);
  });

  it('answers only callers that present the internal key', async () => {
    await request(service.getHttpServer()).get('/health').expect(200);
    await request(service.getHttpServer()).get('/internal/search/stats').expect(401);
    await request(service.getHttpServer())
      .get('/internal/search/stats')
      .set('x-internal-key', 'x'.repeat(48))
      .expect(401);
    await request(service.getHttpServer())
      .post('/internal/search/hybrid')
      .set('x-internal-key', KEY)
      .send({ q: '' })
      .expect(400);
  });

  it('indexes catalog changes through the service', async () => {
    const indexed = jest.spyOn(engine, 'indexProduct');
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: productId,
        type: 'catalog.product.created',
        payload: { productId },
      },
    });
    await api.get(OutboxService).drain();
    expect(indexed).toHaveBeenCalledWith(productId);
    const doc = await prisma.productSearchDoc.findUnique({ where: { productId } });
    expect(doc?.embeddingModel).toMatch(/^local-hash-v1-/);

    const stats = (
      await request(api.getHttpServer())
        .get('/api/v1/admin/search/stats')
        .set('x-internal-key', KEY)
    ).status;
    expect([401, 403]).toContain(stats); // still staff-only on the API side
  });

  it('serves storefront searches from the service', async () => {
    const hybrid = jest.spyOn(engine, 'hybrid');
    const res = await request(api.getHttpServer())
      .get('/api/v1/catalog/products')
      .query({ q: `aurora stunt kite ${run}` })
      .expect(200);
    expect(res.body.items.map((p: { id: string }) => p.id)).toContain(productId);
    expect(hybrid).toHaveBeenCalled();
    expect(api.get(SearchIndexService).remote).toBe(true);
  });

  it('falls back to keyword search when the service is down', async () => {
    // The API's keep-alive connections would hold the server open.
    service.getHttpServer().closeAllConnections();
    await service.close();
    const started = Date.now();
    const res = await request(api.getHttpServer())
      .get('/api/v1/catalog/products')
      .query({ q: `aurora stunt kite ${run}` })
      .expect(200);
    expect(res.body.items.map((p: { id: string }) => p.id)).toContain(productId);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
