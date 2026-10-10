import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type SellerAnalytics } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Store analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const handle = `statsshop-${run}`;
  let owner: string;
  let shopper: string;
  let private_: string;
  let productId: string;
  let variantId: string;

  const signUp = async (name: string) =>
    AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({
            email: `stats-${name}-${run}@example.com`,
            password: 'correct horse battery staple',
          })
          .expect(201)
      ).body,
    ).accessToken;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    owner = await signUp('owner');
    shopper = await signUp('shopper');
    private_ = await signUp('private');
    const ownerRow = await prisma.user.findUniqueOrThrow({
      where: { email: `stats-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle,
        displayName: 'Stats Shop',
        legalName: 'Stats Shop LLC',
        contactEmail: `stats-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: ownerRow.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `statscat-${run}`, name: 'Stats' } });
    const product = await prisma.product.create({
      data: {
        slug: `stats-lamp-${run}`,
        title: `Stats test lamp ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        sellerId: seller.id,
        variants: {
          create: {
            sku: `STATS-${run}`.toUpperCase(),
            title: 'Default',
            priceCents: 3_000,
            inventory: { create: { onHand: 10 } },
          },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;
    // This shopper turned personalized picks off: no view history, but still counted.
    await prisma.user.update({
      where: { email: `stats-private-${run}@example.com` },
      data: { personalizedPicks: false },
    });
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const view = (source: string, token?: string, visitorId?: string) => {
    const req = http().post('/api/v1/events/views');
    return (token ? req.set(bearer(token)) : req)
      .send({ productId, source, ...(visitorId ? { visitorId } : {}) })
      .expect(204);
  };

  it('counts views by source and add-to-carts, and shows the funnel to the store', async () => {
    await view('SEARCH', shopper);
    // A quick repeat by the same shopper doesn't count twice.
    await view('SEARCH', shopper);
    await view('EXTERNAL', undefined, `visitor-${run}-aaaaaaaa`);
    await view('SEARCH', private_);
    await view('APP');
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(shopper))
      .send({ variantId, quantity: 1 })
      .expect(201);
    await http().put(`/api/v1/me/follows/${handle}`).set(bearer(shopper)).expect(200);

    const stats = (
      await http().get('/api/v1/seller/analytics?days=7').set(bearer(owner)).expect(200)
    ).body as SellerAnalytics;
    expect(stats.sources).toEqual([
      { source: 'SEARCH', views: 2 },
      { source: 'APP', views: 1 },
      { source: 'EXTERNAL', views: 1 },
    ]);
    expect(stats.funnel).toEqual({ views: 4, carts: 1, orders: 0 });
    expect(stats.totals.views).toBe(4);
    expect(stats.followers).toEqual({ total: 1, new: 1 });
    expect(stats.topProducts[0]).toMatchObject({ productId, views: 4, carts: 1, units: 0 });
  });

  it('is only for the store’s own team', async () => {
    await http().get('/api/v1/seller/analytics?days=7').set(bearer(shopper)).expect(403);
  });
});
