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
  type ClipCouponView,
  type CouponsPage,
  type ProductDetail,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Dorothy Vaughan',
  line1: '2 Langley Blvd',
  city: 'Hampton',
  region: 'VA',
  postalCode: '23681',
  country: 'US',
};
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('Clip coupons (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let shopperToken: string;
  let otherToken: string;
  let sellerId: string;
  let lampCoupon: ClipCouponView;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function product(
    key: string,
    categoryId: string,
    seller: string | null,
    priceCents: number,
  ) {
    const created = await prisma.product.create({
      data: {
        slug: `clip-${key}-${run}`,
        title: `Clip test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: [
            {
              sku: `CLIP-${key}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents,
              inventory: { create: { onHand: 50 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  const cartWith = async (token: string, key: string, quantity = 1) => {
    const cart = (
      await http()
        .post('/api/v1/cart/buy-now')
        .set(bearer(token))
        .send({ variantId: products[key]!.variantId, quantity })
        .expect(201)
    ).body as Cart;
    return (await http().get(`/api/v1/cart/buy-now/${cart.cartId}`).set(bearer(token)).expect(200))
      .body as Cart;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ownerToken = await signUp(`clip-owner-${run}@example.com`);
    shopperToken = await signUp(`clip-shopper-${run}@example.com`);
    otherToken = await signUp(`clip-other-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `clip-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `clipshop-${run}`,
        displayName: 'Clip Shop',
        legalName: 'Clip Shop LLC',
        contactEmail: `clip-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const cat = await prisma.category.create({ data: { slug: `clipcat-${run}`, name: 'Clip' } });
    await product('lamp', cat.id, seller.id, 4_000);
    await product('rug', cat.id, seller.id, 12_000);
    await product('mug', cat.id, null, 1_500);
  }, 60_000);

  afterAll(async () => {
    await prisma.clipCoupon.deleteMany({ where: { product: { slug: { contains: run } } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('lets a store make coupons for its own listings only', async () => {
    const create = (body: object, status: number) =>
      http().post('/api/v1/seller/coupons').set(bearer(ownerToken)).send(body).expect(status);
    await create(
      { productId: products.mug!.id, kind: 'PERCENT', percentOff: 10, endsAt: inDays(7) },
      400,
    );
    await create(
      { productId: products.lamp!.id, kind: 'AMOUNT', amountOffCents: 4_000, endsAt: inDays(7) },
      400,
    );
    await create({ productId: products.lamp!.id, kind: 'PERCENT', endsAt: inDays(7) }, 400);
    await create(
      { productId: products.lamp!.id, kind: 'PERCENT', percentOff: 15, endsAt: inDays(120) },
      400,
    );
    lampCoupon = (
      await create(
        {
          productId: products.lamp!.id,
          kind: 'PERCENT',
          percentOff: 15,
          endsAt: inDays(7),
          maxRedemptions: 1,
        },
        201,
      )
    ).body as ClipCouponView;
    // One coupon per product at a time.
    await create(
      { productId: products.lamp!.id, kind: 'AMOUNT', amountOffCents: 500, endsAt: inDays(3) },
      409,
    );
    await create(
      { productId: products.rug!.id, kind: 'AMOUNT', amountOffCents: 2_000, endsAt: inDays(7) },
      201,
    );
  });

  it('shows "Save 15% with coupon" on the product, and lists coupons', async () => {
    const detail = (await http().get(`/api/v1/catalog/products/clip-lamp-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.coupon).toEqual({
      id: lampCoupon.id,
      kind: 'PERCENT',
      percentOff: 15,
      amountOffCents: null,
    });
    const page = (await http().get('/api/v1/catalog/coupons').set(bearer(shopperToken)).expect(200))
      .body as CouponsPage;
    expect(page.coupons.map((c) => c.id)).toContain(lampCoupon.id);
    expect(page.clipped).not.toContain(lampCoupon.id);
  });

  it('applies only once clipped, and only to that product', async () => {
    let cart = await cartWith(shopperToken, 'lamp', 2);
    expect(cart.totals.discountCents).toBe(0);
    await http()
      .post(`/api/v1/me/coupons/${lampCoupon.id}/clip`)
      .set(bearer(shopperToken))
      .expect(200);
    // Clipping twice is fine.
    await http()
      .post(`/api/v1/me/coupons/${lampCoupon.id}/clip`)
      .set(bearer(shopperToken))
      .expect(200);
    expect(
      (await http().get('/api/v1/me/coupons/clipped').set(bearer(shopperToken)).expect(200)).body,
    ).toEqual([lampCoupon.id]);
    cart = await cartWith(shopperToken, 'lamp', 2);
    expect(cart.clippedCoupons).toEqual([
      expect.objectContaining({
        id: lampCoupon.id,
        productId: products.lamp!.id,
        discountCents: 1_200,
      }),
    ]);
    expect(cart.totals).toMatchObject({ discountCents: 1_200, clipDiscountCents: 1_200 });
    // Unclipping takes it off again.
    await http()
      .delete(`/api/v1/me/coupons/${lampCoupon.id}/clip`)
      .set(bearer(shopperToken))
      .expect(204);
    cart = await cartWith(shopperToken, 'lamp', 2);
    expect(cart.totals.discountCents).toBe(0);
    await http()
      .post(`/api/v1/me/coupons/${lampCoupon.id}/clip`)
      .set(bearer(shopperToken))
      .expect(200);
  });

  it('is used once, the store funds it, and an unpaid order gives it back', async () => {
    const orders = app.get(OrdersService);
    const cart = await cartWith(shopperToken, 'lamp', 2);
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({
          buyNowId: cart.cartId,
          email: `clip-shopper-${run}@example.com`,
          shippingAddress: address,
        })
        .expect(201)
    ).body as CheckoutResponse;
    expect(checkout.totals).toMatchObject({ discountCents: 1_200, clipDiscountCents: 1_200 });
    // Used: it no longer applies, and the 1-order budget is spent for everyone.
    expect((await cartWith(shopperToken, 'lamp')).totals.discountCents).toBe(0);
    await http()
      .post(`/api/v1/me/coupons/${lampCoupon.id}/clip`)
      .set(bearer(otherToken))
      .expect(409);

    // Left unpaid and cancelled: the clip and the budget come back.
    await prisma.order.update({
      where: { id: checkout.orderId },
      data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
    });
    await orders.cancelStaleOrders();
    expect(
      (await prisma.clipCoupon.findUniqueOrThrow({ where: { id: lampCoupon.id } })).redeemed,
    ).toBe(0);
    const again = await cartWith(shopperToken, 'lamp', 2);
    expect(again.totals.clipDiscountCents).toBe(1_200);
    const paid = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({
          buyNowId: again.cartId,
          email: `clip-shopper-${run}@example.com`,
          shippingAddress: address,
        })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: paid.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: paid.orderId },
      include: { sellerOrders: true },
    });
    expect(order).toMatchObject({
      subtotalCents: 8_000,
      clipDiscountCents: 1_200,
      clipDiscounts: { [sellerId]: 1_200 },
    });
    // 10% commission on $68.00, what the store sold the lamps for.
    expect(order.sellerOrders[0]).toMatchObject({ itemsCents: 6_800, commissionCents: 680 });
  });

  it('stops when the store ends it', async () => {
    const list = (await http().get('/api/v1/seller/coupons').set(bearer(ownerToken)).expect(200))
      .body as ClipCouponView[];
    const rug = list.find((c) => c.product.id === products.rug!.id)!;
    await http().post(`/api/v1/me/coupons/${rug.id}/clip`).set(bearer(otherToken)).expect(200);
    expect((await cartWith(otherToken, 'rug')).totals.clipDiscountCents).toBe(2_000);
    await http().post(`/api/v1/seller/coupons/${rug.id}/end`).set(bearer(ownerToken)).expect(200);
    expect((await cartWith(otherToken, 'rug')).totals.clipDiscountCents).toBeUndefined();
    await http().post(`/api/v1/me/coupons/${rug.id}/clip`).set(bearer(otherToken)).expect(404);
  });
});
