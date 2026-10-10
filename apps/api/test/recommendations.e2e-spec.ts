import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  RecommendationsSchema,
  RelatedProductsSchema,
} from '@nixzora/validation';
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
    await prisma.shopperInterest.deleteMany({
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

  // ───────────── Smart picks (p10-02) ─────────────

  const picksFor = async (query: Record<string, string>, headers: Record<string, string> = {}) =>
    RecommendationsSchema.parse(
      (await http().get('/api/v1/recommendations').query(query).set(headers).expect(200)).body,
    );
  const search = (q: string, visitorId: string, token?: string) =>
    http()
      .post('/api/v1/events/searches')
      .set(token ? { Authorization: `Bearer ${token}` } : {})
      .send({ q, visitorId })
      .expect(204);

  it('turns a search into a "because you searched" row, keeping the finished words', async () => {
    for (const q of ['gps', 'gps run', `gps running watch ${run}`]) await search(q, visitor(20));
    const rows = await prisma.shopperInterest.findMany({ where: { visitorId: visitor(20) } });
    expect(rows.map((row) => row.text)).toEqual([`gps running watch ${run}`]);

    const picks = await picksFor({ visitorId: visitor(20) });
    const interest = picks.rows.find((row) => row.kind === 'interest');
    expect(interest?.subject).toBe(`gps running watch ${run}`);
    expect(interest?.source).toBe('search');
    expect(interest?.products.map((card) => card.id)).toEqual(
      expect.arrayContaining([ids.trail, ids.road]),
    );
  });

  it('remembers what the shopper asked the assistant for', async () => {
    await http()
      .post('/api/v1/assistant/chat')
      .send({
        messages: [{ role: 'user', content: `a GPS sport watch for running ${run}` }],
        visitorId: visitor(21),
      })
      .expect(200);
    const [interest] = await prisma.shopperInterest.findMany({
      where: { visitorId: visitor(21) },
    });
    expect(interest?.source).toBe('ASSISTANT');
    // The search words the assistant understood, not the whole sentence.
    expect(interest?.text).toContain('watch');
    expect(interest?.text).not.toContain(' a ');
  });

  it('brings back a product the shopper keeps coming back to', async () => {
    await view('band', visitor(22));
    await prisma.productEvent.updateMany({
      where: { visitorId: visitor(22) },
      data: { createdAt: new Date(Date.now() - 3 * 3_600_000) },
    });
    await view('band', visitor(22));
    const picks = await picksFor({ visitorId: visitor(22) });
    expect(picks.rows.find((row) => row.kind === 'still_thinking')?.products[0]?.id).toBe(ids.band);
  });

  it('suggests what goes with the cart, from the categories that complement it', async () => {
    const laptops = await prisma.category.findUniqueOrThrow({ where: { slug: 'laptops' } });
    const mice = await prisma.category.findUniqueOrThrow({ where: { slug: 'mice' } });
    await product('laptop', 'Test ultralight laptop', 'A light laptop.', laptops.id);
    await product('mouse', 'Test travel mouse', 'A small wireless mouse.', mice.id);
    const cart = await http()
      .post('/api/v1/cart/items')
      .send({ variantId: variants.laptop, quantity: 1 })
      .expect(201);
    const picks = await picksFor({}, { 'X-Cart-Id': cart.body.cartId });
    const addons = picks.rows.find((row) => row.kind === 'cart_addons');
    expect(addons?.products.map((card) => card.id)).toContain(ids.mouse);
    expect(addons?.products.map((card) => card.id)).not.toContain(ids.laptop);
  });

  it('points out saved items that got cheaper', async () => {
    const email = `picks-${run}@example.com`;
    const token = AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({ email, password: 'correct horse battery staple' })
          .expect(201)
      ).body,
    ).accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    await http().put(`/api/v1/me/wishlist/${ids.kettle}`).set(auth).expect(204);
    await prisma.productVariant.update({
      where: { id: variants.kettle },
      data: { priceCents: 7_900 },
    });
    const picks = await picksFor({}, auth);
    expect(picks.rows.find((row) => row.kind === 'saved_deals')?.products[0]?.id).toBe(ids.kettle);

    // Turning personalized picks off forgets history and stops recording it.
    await search('electric kettle', visitor(23), token);
    await http()
      .put('/api/v1/me/preferences')
      .set(auth)
      .send({ marketingEmails: false, reviewRequests: true, personalizedPicks: false })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.shopperInterest.count({ where: { userId: user.id } })).toBe(0);
    await search('electric kettle', visitor(23), token);
    await http().post('/api/v1/events/views').set(auth).send({ productId: ids.kettle }).expect(204);
    expect(await prisma.shopperInterest.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.productEvent.count({ where: { userId: user.id } })).toBe(0);
    const off = await picksFor({}, auth);
    expect(off.rows).toEqual([]);
    expect(off.basis).toBe('popular');
  });

  it("clears a shopper's history on request", async () => {
    const email = `clear-${run}@example.com`;
    const token = AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({ email, password: 'correct horse battery staple' })
          .expect(201)
      ).body,
    ).accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    await search('trail watch', visitor(24), token);
    await http().post('/api/v1/events/views').set(auth).send({ productId: ids.trail }).expect(204);
    await http()
      .delete('/api/v1/me/shopping-history')
      .query({ visitorId: visitor(24) })
      .set(auth)
      .expect(204);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.productEvent.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.shopperInterest.count({ where: { userId: user.id } })).toBe(0);
  });
});
