import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type BrowsingHistory, type PriceHistory } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PriceHistoryService } from '../src/modules/price-history/price-history.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const DAY = 86_400_000;

describe('Price history and browsing history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let prices: PriceHistoryService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let token: string;
  let productId: string;
  let variantId: string;
  const slug = `ph-kettle-${run}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    prices = app.get(PriceHistoryService);
    const cat = await prisma.category.create({ data: { slug: `phcat-${run}`, name: 'Prices' } });
    const product = await prisma.product.create({
      data: {
        slug,
        title: `Price kettle ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: [
            {
              sku: `PH-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 10_000,
              inventory: { create: { onHand: 5 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `ph-${run}@example.com`, password: 'correct horse battery staple' })
      .expect(201);
    token = AuthTokensSchema.parse(res.body).accessToken;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const points = () =>
    prisma.pricePoint.findMany({ where: { productId }, orderBy: { recordedAt: 'asc' } });

  it('records a point only when the price changes', async () => {
    expect(await prices.record(productId)).toBe(1);
    expect(await prices.record(productId)).toBe(0);
    // 60 days at $100 so far.
    await prisma.pricePoint.updateMany({
      where: { productId },
      data: { recordedAt: new Date(Date.now() - 60 * DAY) },
    });
    const history = (await http().get(`/api/v1/catalog/products/${slug}/price-history`).expect(200))
      .body as PriceHistory;
    expect(history).toMatchObject({
      days: 90,
      changed: false,
      lowestIn30Days: false,
      currentCents: 10_000,
    });
  });

  it('shows the drop, the typical price and "lowest in 30 days"', async () => {
    await prisma.productVariant.update({ where: { id: variantId }, data: { priceCents: 8_000 } });
    expect(await prices.record()).toBeGreaterThanOrEqual(1);
    expect((await points()).map((p) => p.priceCents)).toEqual([10_000, 8_000]);
    // The drop happened 10 days ago.
    await prisma.pricePoint.updateMany({
      where: { productId, priceCents: 8_000 },
      data: { recordedAt: new Date(Date.now() - 10 * DAY) },
    });
    const history = (
      await http().get(`/api/v1/catalog/products/${slug}/price-history?days=90`).expect(200)
    ).body as PriceHistory;
    expect(history).toMatchObject({
      changed: true,
      currentCents: 8_000,
      lowestCents: 8_000,
      highestCents: 10_000,
      lowestIn30Days: true,
    });
    expect(history.typicalCents).toBeGreaterThan(8_000);
    expect(history.typicalCents).toBeLessThan(10_000);
    await http().get(`/api/v1/catalog/products/${slug}/price-history?days=7`).expect(400);
  });

  it("keeps the customer's browsing history, with the price then and what dropped since", async () => {
    // Viewed at $80; the price then goes down to $70.
    await http()
      .post('/api/v1/events/views')
      .set({ Authorization: `Bearer ${token}` })
      .send({ productId })
      .expect(204);
    await prisma.pricePoint.updateMany({
      where: { productId, priceCents: 8_000 },
      data: { recordedAt: new Date(Date.now() - 2 * DAY) },
    });
    await prisma.productVariant.update({ where: { id: variantId }, data: { priceCents: 7_000 } });
    await prices.record(productId);
    let history = (
      await http()
        .get('/api/v1/me/history')
        .set({ Authorization: `Bearer ${token}` })
        .expect(200)
    ).body as BrowsingHistory;
    expect(history.paused).toBe(false);
    expect(history.items[0]).toMatchObject({
      product: { id: productId },
      priceThenCents: 8_000,
      droppedCents: 1_000,
      alertOn: false,
    });
    await http()
      .delete(`/api/v1/me/history/${productId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(204);
    history = (
      await http()
        .get('/api/v1/me/history')
        .set({ Authorization: `Bearer ${token}` })
        .expect(200)
    ).body as BrowsingHistory;
    expect(history.items).toEqual([]);
    await http().get('/api/v1/me/history').expect(401);
  });
});
