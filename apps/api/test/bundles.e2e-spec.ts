import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type BundleView,
  type Cart,
  type CheckoutResponse,
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

describe('Bundle & save (e2e)', () => {
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
  let storeBundle: BundleView;

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
        slug: `bnd-${key}-${run}`,
        title: `Bundle test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `BND-${key}-${i}-${run}`.toUpperCase(),
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
    ownerToken = await signUp(`bnd-owner-${run}@example.com`);
    staffToken = await staff(`bnd-staff-${run}@example.com`);
    shopperToken = await signUp(`bnd-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `bnd-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `bndshop-${run}`,
        displayName: 'Bundle Shop',
        legalName: 'Bundle Shop LLC',
        contactEmail: `bnd-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const cat = await prisma.category.create({ data: { slug: `bndcat-${run}`, name: 'Bundles' } });
    await product('camera', cat.id, seller.id, 40_000);
    await product('bag', cat.id, seller.id, 6_000);
    await product('card', cat.id, seller.id, 4_000);
    await product('tee', cat.id, seller.id, 2_000, 3);
    await product('mug', cat.id, null, 1_500);
    await product('beans', cat.id, null, 2_500);
  }, 60_000);

  afterAll(async () => {
    await prisma.bundle.deleteMany({ where: { title: { contains: run } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('lets a store bundle only its own single-option listings', async () => {
    const create = (token: string, body: object, status: number) =>
      http().post('/api/v1/seller/bundles').set(bearer(token)).send(body).expect(status);
    // Someone else's product.
    await create(
      ownerToken,
      {
        title: `Coffee ${run}`,
        percentOff: 10,
        productIds: [products.mug!.id, products.bag!.id],
      },
      400,
    );
    // Sizes to choose from.
    await create(
      ownerToken,
      { title: `Tee ${run}`, percentOff: 10, productIds: [products.tee!.id, products.bag!.id] },
      400,
    );
    // Outside 5–30%.
    await create(
      ownerToken,
      { title: `Big ${run}`, percentOff: 50, productIds: [products.camera!.id, products.bag!.id] },
      400,
    );
    storeBundle = (
      await create(
        ownerToken,
        {
          title: `Camera kit ${run}`,
          percentOff: 10,
          productIds: [products.camera!.id, products.bag!.id, products.card!.id],
        },
        201,
      )
    ).body as BundleView;
    expect(storeBundle).toMatchObject({
      percentOff: 10,
      priceCents: 50_000,
      bundlePriceCents: 45_000,
      available: true,
      seller: { handle: `bndshop-${run}` },
    });
    // The same set twice.
    await create(
      ownerToken,
      {
        title: `Again ${run}`,
        percentOff: 15,
        productIds: [products.card!.id, products.camera!.id, products.bag!.id],
      },
      409,
    );
    // A shopper isn't a store.
    await create(
      shopperToken,
      { title: `Nope ${run}`, percentOff: 10, productIds: [products.camera!.id, products.bag!.id] },
      403,
    );
  });

  it('shows the bundle on each of its products, that product first', async () => {
    const res = await http().get(`/api/v1/catalog/products/bnd-bag-${run}/bundles`).expect(200);
    const [bundle] = res.body as BundleView[];
    expect(bundle?.id).toBe(storeBundle.id);
    expect(bundle?.products.map((p) => p.id)).toEqual([
      products.bag!.id,
      products.camera!.id,
      products.card!.id,
    ]);
  });

  it('adds the whole bundle in one go and takes 10% off each complete set', async () => {
    const res = await http()
      .post(`/api/v1/cart/bundles/${storeBundle.id}`)
      .set(bearer(shopperToken))
      .expect(201);
    let cart = res.body as Cart;
    expect(cart.lines).toHaveLength(3);
    expect(cart.bundles).toEqual([
      expect.objectContaining({ id: storeBundle.id, sets: 1, discountCents: 5_000 }),
    ]);
    expect(cart.totals).toMatchObject({
      subtotalCents: 50_000,
      discountCents: 5_000,
      bundleDiscountCents: 5_000,
    });
    // A second camera alone doesn't make a second set.
    cart = await add(shopperToken, 'camera');
    expect(cart.bundles?.[0]).toMatchObject({ sets: 1, discountCents: 5_000 });
    // Removing part of the set removes the saving.
    await http()
      .patch(`/api/v1/cart/items/${products.card!.variantId}`)
      .set(bearer(shopperToken))
      .send({ quantity: 0 })
      .expect(200);
    cart = (await http().get('/api/v1/cart').set(bearer(shopperToken)).expect(200)).body as Cart;
    expect(cart.bundles).toBeUndefined();
    expect(cart.totals.discountCents).toBe(0);
    await add(shopperToken, 'card');
    await http()
      .patch(`/api/v1/cart/items/${products.camera!.variantId}`)
      .set(bearer(shopperToken))
      .send({ quantity: 1 })
      .expect(200);
  });

  it('records the saving on the order, and the store funds it', async () => {
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({ email: `bnd-shopper-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    expect(checkout.totals).toMatchObject({ discountCents: 5_000, bundleDiscountCents: 5_000 });
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
      subtotalCents: 50_000,
      discountCents: 5_000,
      bundleDiscountCents: 5_000,
      bundleDiscounts: { [sellerId]: 5_000 },
    });
    // 10% commission on what the store sold the set for ($450), not the list prices ($500).
    expect(order.sellerOrders[0]).toMatchObject({
      itemsCents: 45_000,
      commissionCents: 4_500,
    });
  });

  it("lets staff bundle NIXZORA's own products, and retire any bundle", async () => {
    const created = (
      await http()
        .post('/api/v1/admin/bundles')
        .set(bearer(staffToken))
        .send({
          title: `Coffee set ${run}`,
          percentOff: 20,
          productIds: [products.mug!.id, products.beans!.id],
        })
        .expect(201)
    ).body as BundleView;
    expect(created.bundlePriceCents).toBe(3_200);
    // Staff can't bundle a store's products (the store funds its own).
    await http()
      .post('/api/v1/admin/bundles')
      .set(bearer(staffToken))
      .send({
        title: `Mixed ${run}`,
        percentOff: 10,
        productIds: [products.mug!.id, products.bag!.id],
      })
      .expect(400);
    // A store can't retire NIXZORA's bundle; staff can retire the store's.
    await http()
      .post(`/api/v1/seller/bundles/${created.id}/archive`)
      .set(bearer(ownerToken))
      .expect(404);
    const archived = (
      await http()
        .post(`/api/v1/admin/bundles/${storeBundle.id}/archive`)
        .set(bearer(staffToken))
        .expect(200)
    ).body as BundleView;
    expect(archived.status).toBe('ARCHIVED');
    const list = (await http().get('/api/v1/seller/bundles').set(bearer(ownerToken)).expect(200))
      .body as BundleView[];
    expect(list.map((b) => b.status)).toEqual(['ARCHIVED']);
    // An archived bundle no longer shows or discounts.
    const shown = (await http().get(`/api/v1/catalog/products/bnd-bag-${run}/bundles`).expect(200))
      .body as BundleView[];
    expect(shown).toEqual([]);
    await http()
      .post(`/api/v1/cart/bundles/${storeBundle.id}`)
      .set(bearer(shopperToken))
      .expect(404);
  });
});
