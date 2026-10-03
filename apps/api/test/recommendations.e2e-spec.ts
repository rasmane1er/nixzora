import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RecommendationsSchema, RelatedProductsSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { RecommendationsService } from '../src/modules/recommendations/recommendations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Recommendations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const ids: Record<string, string> = {};
  const variants: Record<string, string> = {};
  const visitor = (n: number) => `visitor-${run}-${n}`.padEnd(20, 'x');

  async function product(key: string, title: string, description: string, categoryId: string) {
    const created = await prisma.product.create({
      data: {
        slug: `${key}-${run}`,
        title: `${title} ${run}`,
        description,
        status: 'ACTIVE',
        categoryId,
        variants: {
          create: [
            {
              sku: `${key}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 9_900,
              inventory: { create: { onHand: 5 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    ids[key] = created.id;
    variants[key] = created.variants[0]!.id;
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: created.id,
        type: 'catalog.product.created',
        payload: { productId: created.id },
      },
    });
  }

  const view = (key: string, visitorId: string) =>
    http().post('/api/v1/events/views').send({ productId: ids[key], visitorId }).expect(204);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const watches = await prisma.category.create({
      data: { slug: `watches-${run}`, name: 'Watches' },
    });
    const kitchen = await prisma.category.create({
      data: { slug: `kitchen-${run}`, name: 'Kitchen' },
    });
    await product(
      'trail',
      'Trail GPS running watch',
      'GPS running watch, heart rate, 7-day battery.',
      watches.id,
    );
    await product(
      'road',
      'Road GPS sport watch',
      'GPS sport watch for runners with heart rate.',
      watches.id,
    );
    await product(
      'band',
      'Fitness band',
      'Step and sleep tracker band with heart rate.',
      watches.id,
    );
    await product(
      'kettle',
      'Electric kettle',
      'Boils water fast, 1.7 litre, auto shut-off.',
      kitchen.id,
    );
    await product(
      'strap',
      'Spare silicone strap',
      'Replacement watch strap, 22 mm, sweat-proof.',
      kitchen.id,
    );
    await app.get(OutboxService).drain();

    // Two paid orders put the trail watch and the strap together.
    for (const n of [1, 2]) {
      await prisma.order.create({
        data: {
          number: `T-${run}-${n}`,
          email: `buyer-${n}-${run}@example.com`,
          status: 'PAID',
          placedAt: new Date(),
          subtotalCents: 19_800,
          totalCents: 19_800,
          shippingAddress: {},
          items: {
            create: ['trail', 'strap'].map((key) => ({
              variantId: variants[key],
              sku: `${key}-${run}`.toUpperCase(),
              productTitle: key,
              variantTitle: 'Standard',
              unitPriceCents: 9_900,
              quantity: 1,
              totalCents: 9_900,
            })),
          },
        },
      });
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.productEvent.deleteMany({
      where: { visitorId: { startsWith: `visitor-${run}` } },
    });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('shows similar products of the same kind first, and what sells together', async () => {
    const res = await http().get(`/api/v1/catalog/products/trail-${run}/related`).expect(200);
    const related = RelatedProductsSchema.parse(res.body);
    const similar = related.similar.map((card) => card.id);
    expect(similar).not.toContain(ids.trail);
    expect(similar.indexOf(ids.road!)).toBeGreaterThanOrEqual(0);
    expect(similar.indexOf(ids.road!)).toBeLessThan(
      similar.includes(ids.kettle!) ? similar.indexOf(ids.kettle!) : Infinity,
    );
    expect(related.boughtTogether.map((card) => card.id)).toEqual([ids.strap]);
    // A product never shows up in two lists.
    expect(similar).not.toContain(ids.strap);
  });

  it('records views once per half hour and needs a shopper id', async () => {
    await view('road', visitor(1));
    await view('road', visitor(1));
    await http().post('/api/v1/events/views').send({ productId: ids.road }).expect(204);
    await http()
      .post('/api/v1/events/views')
      .send({ productId: ids.road, visitorId: 'short' })
      .expect(400);
    expect(await prisma.productEvent.count({ where: { productId: ids.road } })).toBe(1);
  });

  it('only shows "also viewed" once two different shoppers did it', async () => {
    await view('trail', visitor(2));
    await view('band', visitor(2));
    let related = RelatedProductsSchema.parse(
      (await http().get(`/api/v1/catalog/products/trail-${run}/related`)).body,
    );
    expect(related.alsoViewed.map((card) => card.id)).not.toContain(ids.band);

    await view('trail', visitor(3));
    await view('band', visitor(3));
    related = RelatedProductsSchema.parse(
      (await http().get(`/api/v1/catalog/products/trail-${run}/related`)).body,
    );
    expect(related.alsoViewed.map((card) => card.id)).toContain(ids.band);
  });

  it('recommends from viewing history, and popular products without one', async () => {
    await view('trail', visitor(4));
    const res = await http()
      .get('/api/v1/recommendations')
      .query({ visitorId: visitor(4) })
      .expect(200);
    const picks = RecommendationsSchema.parse(res.body);
    expect(picks.recentlyViewed.map((card) => card.id)).toEqual([ids.trail]);
    expect(picks.products.map((card) => card.id)).not.toContain(ids.trail);

    const fresh = RecommendationsSchema.parse(
      (await http().get('/api/v1/recommendations').expect(200)).body,
    );
    expect(fresh.basis).toBe('popular');
    expect(fresh.recentlyViewed).toEqual([]);
    expect(fresh.products.length).toBeGreaterThan(0);
  });

  it('deletes events after the retention period', async () => {
    await prisma.productEvent.create({
      data: {
        productId: ids.kettle!,
        type: 'VIEW',
        visitorId: visitor(9),
        createdAt: new Date(Date.now() - 200 * 86_400_000),
      },
    });
    expect(await app.get(RecommendationsService).purgeOldEvents()).toBeGreaterThanOrEqual(1);
    expect(await prisma.productEvent.count({ where: { visitorId: visitor(9) } })).toBe(0);
  });
});
