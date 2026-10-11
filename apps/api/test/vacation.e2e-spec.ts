import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type ProductDetail,
  addDays,
  easternToday,
  type PublicSeller,
  type SellerView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Store vacation mode (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let ownerToken: string;
  let shopperToken: string;
  let variantId: string;
  const today = easternToday();

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ownerToken = await signUp(`vac-owner-${run}@example.com`);
    shopperToken = await signUp(`vac-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `vac-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `vacshop-${run}`,
        displayName: 'Away Shop',
        legalName: 'Away Shop LLC',
        contactEmail: `vac-owner-${run}@example.com`,
        status: 'ACTIVE',
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `vaccat-${run}`, name: 'Away' } });
    const product = await prisma.product.create({
      data: {
        slug: `vac-lamp-${run}`,
        title: `Away lamp ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        sellerId: seller.id,
        variants: {
          create: [
            {
              sku: `VAC-LAMP-${run}`.toUpperCase(),
              title: 'Default',
              priceCents: 3_000,
              inventory: { create: { onHand: 10 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const setVacation = (body: object, status: number) =>
    http().put('/api/v1/seller/vacation').set(bearer(ownerToken)).send(body).expect(status);

  it('checks the dates', async () => {
    await setVacation({ from: addDays(today, -1) }, 400);
    await setVacation({ from: today, until: today }, 400);
    await setVacation({ from: today, until: addDays(today, 120) }, 400);
    await http()
      .put('/api/v1/seller/vacation')
      .set(bearer(shopperToken))
      .send({ from: today })
      .expect(403);
  });

  it('a vacation that starts later changes nothing yet', async () => {
    const view = (await setVacation({ from: addDays(today, 3) }, 200)).body as SellerView;
    expect(view.vacation).toMatchObject({ from: addDays(today, 3), until: null });
    expect(view.away).toBeNull();
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(shopperToken))
      .send({ variantId, quantity: 1 })
      .expect(201);
  });

  it('while away: visible, not buyable, and the cart says why', async () => {
    const until = addDays(today, 7);
    const view = (
      await setVacation({ from: today, until, message: 'Back after the holidays.' }, 200)
    ).body as SellerView;
    expect(view.away).toEqual({ until, message: 'Back after the holidays.' });

    const detail = (await http().get(`/api/v1/catalog/products/vac-lamp-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.storeAway).toEqual({ until });
    expect(detail.seller?.away).toEqual({ until, message: 'Back after the holidays.' });
    const store = (await http().get(`/api/v1/catalog/sellers/vacshop-${run}`).expect(200))
      .body as PublicSeller;
    expect(store.away?.until).toBe(until);

    await http()
      .post('/api/v1/cart/items')
      .set(bearer(shopperToken))
      .send({ variantId, quantity: 1 })
      .expect(400);
    const cart = (await http().get('/api/v1/cart').set(bearer(shopperToken)).expect(200))
      .body as Cart;
    expect(cart.lines[0]).toMatchObject({
      problem: 'UNAVAILABLE',
      storeAway: { store: 'Away Shop', until },
    });
  });

  it('back on: buyable again', async () => {
    const view = (
      await http().delete('/api/v1/seller/vacation').set(bearer(ownerToken)).expect(200)
    ).body as SellerView;
    expect(view.vacation).toBeNull();
    const cart = (await http().get('/api/v1/cart').set(bearer(shopperToken)).expect(200))
      .body as Cart;
    expect(cart.lines[0]?.problem).toBeNull();
    expect(cart.lines[0]?.storeAway).toBeUndefined();
  });
});
