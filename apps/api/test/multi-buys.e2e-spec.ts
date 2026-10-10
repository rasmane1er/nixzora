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
  type CheckoutResponse,
  type MultiBuyView,
  type ProductDetail,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Katherine Johnson',
  line1: '1 Langley Blvd',
  city: 'Hampton',
  region: 'VA',
  postalCode: '23681',
  country: 'US',
};

describe('Buy X, get Y (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let staffToken: string;
  let shopperToken: string;
  let sellerId: string;
  let offer: MultiBuyView;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function staff(email: string): Promise<string> {
    const token = await signUp(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRole.create({
      data: { user: { connect: { id: user.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(token)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(token))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    return token;
  }

  async function product(
    key: string,
    categoryId: string,
    seller: string | null,
    priceCents: number,
    options = 1,
  ) {
    const created = await prisma.product.create({
      data: {
        slug: `mb-${key}-${run}`,
        title: `Offer test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `MB-${key}-${i}-${run}`.toUpperCase(),
            title: `Option ${i + 1}`,
            priceCents,
            inventory: { create: { onHand: 20 } },
          })),
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  const add = async (token: string, key: string, quantity = 1) =>
    (
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(token))
        .send({ variantId: products[key]!.variantId, quantity })
        .expect(201)
    ).body as Cart;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ownerToken = await signUp(`mb-owner-${run}@example.com`);
    staffToken = await staff(`mb-staff-${run}@example.com`);
    shopperToken = await signUp(`mb-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `mb-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `mbshop-${run}`,
        displayName: 'Offer Shop',
        legalName: 'Offer Shop LLC',
        contactEmail: `mb-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const cat = await prisma.category.create({ data: { slug: `mbcat-${run}`, name: 'Offers' } });
    await product('tee', cat.id, seller.id, 2_000, 3);
    await product('socks', cat.id, seller.id, 1_000);
    await product('mug', cat.id, null, 1_500);
  }, 60_000);

  afterAll(async () => {
    await prisma.multiBuy.deleteMany({
      where: { products: { some: { product: { slug: { contains: run } } } } },
    });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('lets a store make offers on its own live listings, one live offer per product', async () => {
    const create = (token: string, body: object, status: number) =>
      http().post('/api/v1/seller/multi-buys').set(bearer(token)).send(body).expect(status);
    const terms = { buyQty: 2, getQty: 1, percentOff: 100 };
    await create(ownerToken, { ...terms, productIds: [products.mug!.id] }, 400);
    await create(ownerToken, { ...terms, getQty: 3, productIds: [products.tee!.id] }, 400);
    await create(shopperToken, { ...terms, productIds: [products.tee!.id] }, 403);
    offer = (
      await create(
        ownerToken,
        { ...terms, days: 7, productIds: [products.tee!.id, products.socks!.id] },
        201,
      )
    ).body as MultiBuyView;
    expect(offer).toMatchObject({ ...terms, status: 'ACTIVE', orders: 0 });
    expect(offer.endsAt).not.toBeNull();
    await create(ownerToken, { ...terms, productIds: [products.socks!.id] }, 409);
  });

  it('shows the offer on its products and on its own page', async () => {
    const detail = (await http().get(`/api/v1/catalog/products/mb-tee-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.multiBuy).toMatchObject({ id: offer.id, buyQty: 2, getQty: 1, percentOff: 100 });
    const page = (await http().get(`/api/v1/catalog/multi-buys/${offer.id}`).expect(200))
      .body as MultiBuyView;
    expect(page.products.map((p) => p.id).sort()).toEqual(
      [products.tee!.id, products.socks!.id].sort(),
    );
  });

  it('makes the cheapest of every three free, and says when one more would be free', async () => {
    let cart = await add(shopperToken, 'tee', 2);
    expect(cart.multiBuys).toEqual([
      expect.objectContaining({ id: offer.id, times: 0, discountCents: 0, addMore: 1 }),
    ]);
    expect(cart.totals.discountCents).toBe(0);
    cart = await add(shopperToken, 'socks');
    expect(cart.multiBuys?.[0]).toMatchObject({ times: 1, discountCents: 1_000, addMore: 0 });
    expect(cart.totals).toMatchObject({
      subtotalCents: 5_000,
      discountCents: 1_000,
      multiBuyDiscountCents: 1_000,
    });
  });

  it('records the saving on the order, and the store funds it', async () => {
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({ email: `mb-shopper-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    expect(checkout.totals).toMatchObject({ discountCents: 1_000, multiBuyDiscountCents: 1_000 });
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: checkout.orderId },
      include: { sellerOrders: true },
    });
    expect(order).toMatchObject({
      multiBuyDiscountCents: 1_000,
      multiBuyDiscounts: { [sellerId]: 1_000 },
      multiBuyUses: { [offer.id]: 1_000 },
    });
    // 10% commission on what the store sold for ($40), not the list prices ($50).
    expect(order.sellerOrders[0]).toMatchObject({ itemsCents: 4_000, commissionCents: 400 });
    const [mine] = (
      await http().get('/api/v1/seller/multi-buys').set(bearer(ownerToken)).expect(200)
    ).body as MultiBuyView[];
    expect(mine).toMatchObject({ id: offer.id, orders: 1 });
  });

  it("lets staff run NIXZORA's offers and end any offer", async () => {
    const half = (
      await http()
        .post('/api/v1/admin/multi-buys')
        .set(bearer(staffToken))
        .send({ buyQty: 1, getQty: 1, percentOff: 50, productIds: [products.mug!.id] })
        .expect(201)
    ).body as MultiBuyView;
    const cart = await add(shopperToken, 'mug', 2);
    expect(cart.multiBuys?.[0]).toMatchObject({ id: half.id, discountCents: 750 });
    await http()
      .post(`/api/v1/admin/multi-buys/${offer.id}/end`)
      .set(bearer(staffToken))
      .expect(200);
    await http().get(`/api/v1/catalog/multi-buys/${offer.id}`).expect(404);
    const detail = (await http().get(`/api/v1/catalog/products/mb-tee-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.multiBuy).toBeUndefined();
  });
});
