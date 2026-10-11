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
  type ProductDetail,
  type SpendOfferView,
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

describe('Spend more, save more (e2e)', () => {
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
  let offer: SpendOfferView;
  let paused: string[] = [];

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
        slug: `sp-${key}-${run}`,
        title: `Offer test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `SP-${key}-${i}-${run}`.toUpperCase(),
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
    ownerToken = await signUp(`sp-owner-${run}@example.com`);
    staffToken = await staff(`sp-staff-${run}@example.com`);
    shopperToken = await signUp(`sp-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `sp-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `spshop-${run}`,
        displayName: 'Spend Shop',
        legalName: 'Spend Shop LLC',
        contactEmail: `sp-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const cat = await prisma.category.create({ data: { slug: `spcat-${run}`, name: 'Offers' } });
    await product('lamp', cat.id, seller.id, 3_000);
    await product('shade', cat.id, seller.id, 2_000);
    await product('mug', cat.id, null, 4_000);
    // NIXZORA's own live offers (dev data) step aside while this runs.
    paused = (
      await prisma.spendOffer.findMany({
        where: { sellerId: null, status: 'ACTIVE' },
        select: { id: true },
      })
    ).map((o) => o.id);
    await prisma.spendOffer.updateMany({
      where: { id: { in: paused } },
      data: { status: 'ENDED' },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.spendOffer.deleteMany({
      where: { OR: [{ sellerId }, { id: { in: created } }] },
    });
    await prisma.spendOffer.updateMany({
      where: { id: { in: paused } },
      data: { status: 'ACTIVE' },
    });
    await removeTestData(prisma, run);
    await app.close();
  });

  const created: string[] = [];
  const tiers = [
    { minCents: 5_000, offCents: 500 },
    { minCents: 10_000, offCents: 1_500 },
  ];

  it('lets a store set climbing tiers, one live offer at a time', async () => {
    const create = (token: string, body: object, status: number) =>
      http().post('/api/v1/seller/spend-offers').set(bearer(token)).send(body).expect(status);
    // Tiers must climb, and a saving is at most half the spend.
    await create(ownerToken, { tiers: [tiers[1], tiers[0]] }, 400);
    await create(ownerToken, { tiers: [{ minCents: 2_000, offCents: 1_500 }] }, 400);
    await create(shopperToken, { tiers }, 403);
    offer = (await create(ownerToken, { tiers, days: 14 }, 201)).body as SpendOfferView;
    created.push(offer.id);
    expect(offer).toMatchObject({ tiers, status: 'ACTIVE', orders: 0 });
    expect(offer.seller?.displayName).toBe('Spend Shop');
    await create(ownerToken, { tiers }, 409);
  });

  it("shows on the store's product pages and on Today's deals, not on others", async () => {
    const detail = (await http().get(`/api/v1/catalog/products/sp-lamp-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.spendOffer).toMatchObject({ id: offer.id, tiers });
    const mug = (await http().get(`/api/v1/catalog/products/sp-mug-${run}`).expect(200))
      .body as ProductDetail;
    expect(mug.spendOffer).toBeNull();
    const live = (await http().get('/api/v1/catalog/spend-offers').expect(200))
      .body as SpendOfferView[];
    expect(live.map((o) => o.id)).toContain(offer.id);
  });

  it("counts only the store's items, and nudges towards the next tier", async () => {
    let cart = await add(shopperToken, 'lamp');
    cart = await add(shopperToken, 'mug');
    expect(cart.spendOffers).toEqual([
      expect.objectContaining({
        id: offer.id,
        spentCents: 3_000,
        discountCents: 0,
        next: { minCents: 5_000, offCents: 500, moreCents: 2_000 },
      }),
    ]);
    cart = await add(shopperToken, 'shade');
    expect(cart.spendOffers?.[0]).toMatchObject({
      spentCents: 5_000,
      discountCents: 500,
      next: { minCents: 10_000, moreCents: 5_000 },
    });
    expect(cart.totals).toMatchObject({
      subtotalCents: 9_000,
      discountCents: 500,
      spendDiscountCents: 500,
    });
  });

  it('records the saving on the order, and the store funds it', async () => {
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({ email: `sp-shopper-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    expect(checkout.totals).toMatchObject({ discountCents: 500, spendDiscountCents: 500 });
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
      spendDiscountCents: 500,
      spendDiscounts: { [sellerId]: 500 },
      spendUses: { [offer.id]: 500 },
    });
    // 10% commission on what the store sold for ($45), not its list prices ($50).
    expect(order.sellerOrders[0]).toMatchObject({ itemsCents: 4_500, commissionCents: 450 });
    const [mine] = (
      await http().get('/api/v1/seller/spend-offers').set(bearer(ownerToken)).expect(200)
    ).body as SpendOfferView[];
    expect(mine).toMatchObject({ id: offer.id, orders: 1 });
  });

  it("lets staff run NIXZORA's own tiers and end any store's", async () => {
    const own = (
      await http()
        .post('/api/v1/admin/spend-offers')
        .set(bearer(staffToken))
        .send({ tiers: [{ minCents: 7_500, offCents: 1_000 }] })
        .expect(201)
    ).body as SpendOfferView;
    created.push(own.id);
    expect(own.seller).toBeNull();
    let cart = await add(shopperToken, 'mug', 2);
    expect(cart.spendOffers?.find((o) => o.id === own.id)).toMatchObject({
      spentCents: 8_000,
      discountCents: 1_000,
      next: null,
    });
    await http()
      .post(`/api/v1/admin/spend-offers/${own.id}/end`)
      .set(bearer(staffToken))
      .expect(200);
    await http()
      .post(`/api/v1/admin/spend-offers/${offer.id}/end`)
      .set(bearer(staffToken))
      .expect(200);
    cart = (await http().get('/api/v1/cart').set(bearer(shopperToken)).expect(200)).body as Cart;
    expect(cart.spendOffers).toBeUndefined();
    const detail = (await http().get(`/api/v1/catalog/products/sp-lamp-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.spendOffer).toBeNull();
  });
});
