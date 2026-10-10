import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.SHIPPING_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';
process.env.TAX_RATES_BPS = 'MD:600';
process.env.SHIPPING_FLAT_CENTS = '999';
process.env.FREE_SHIPPING_THRESHOLD_CENTS = '9900';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type CheckoutResponse,
  type OrderView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { MailService } from '../src/modules/notifications/mail.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Ada Lovelace',
  line1: '100 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

describe('Promotions, reviews, wishlist, refunds, returns and labels (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let productId: string;
  let productSlug: string;
  /** $50.00, 50 in stock */
  let variantId: string;
  let staffToken: string;
  let customerToken: string;
  const customerEmail = `buyer-${run}@example.com`;

  async function signUp(email: string, firstName?: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple', firstName })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function staff(email: string, role: string): Promise<string> {
    const token = await signUp(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRole.create({
      data: { user: { connect: { id: user.id } }, role: { connect: { key: role } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(token)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(token))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    return token;
  }

  /** Signed-in purchase of `quantity` units, paid. */
  async function buy(token: string, quantity: number, coupon?: string): Promise<CheckoutResponse> {
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ variantId, quantity })
      .expect(201);
    if (coupon)
      await http()
        .post('/api/v1/cart/coupon')
        .set(bearer(token))
        .send({ code: coupon })
        .expect(201);
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(token))
        .send({ email: customerEmail, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    return checkout;
  }

  async function adminOrder(id: string): Promise<OrderView> {
    return (await http().get(`/api/v1/admin/orders/${id}`).set(bearer(staffToken)).expect(200))
      .body;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    mail = app.get(MailService);

    const category = await prisma.category.create({
      data: { name: `Ops ${run}`, slug: `ops-${run}`, isActive: false },
    });
    const product = await prisma.product.create({
      data: {
        title: `Test Hub ${run}`,
        slug: `test-hub-${run}`,
        description: 'A USB hub used by the operations tests.',
        status: 'ACTIVE',
        categoryId: category.id,
        variants: {
          create: [
            {
              sku: `HUB-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 5000,
              inventory: { create: { onHand: 50 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    productSlug = product.slug;
    variantId = product.variants[0]!.id;
    staffToken = await staff(`ops-admin-${run}@example.com`, 'admin');
    customerToken = await signUp(customerEmail, 'Ada');
  });

  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { contains: run.toUpperCase() } } });
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  describe('coupons', () => {
    const code = `SAVE10-${run}`.toUpperCase();
    const capped = `ONCE-${run}`.toUpperCase();

    it('lets promotion managers create codes, and nobody else', async () => {
      await http()
        .post('/api/v1/admin/coupons')
        .set(bearer(customerToken))
        .send({ code, type: 'PERCENT', value: 1000 })
        .expect(403);
      await http()
        .post('/api/v1/admin/coupons')
        .set(bearer(staffToken))
        .send({ code: code.toLowerCase(), type: 'PERCENT', value: 1000, minSubtotalCents: 8000 })
        .expect(201);
      await http()
        .post('/api/v1/admin/coupons')
        .set(bearer(staffToken))
        .send({ code, type: 'PERCENT', value: 1000 })
        .expect(409);
      await http()
        .post('/api/v1/admin/coupons')
        .set(bearer(staffToken))
        .send({ code: capped, type: 'FIXED', value: 1500, maxRedemptions: 1 })
        .expect(201);
    });

    it('checks the minimum spend, then discounts before shipping and tax', async () => {
      const guest = await http()
        .post('/api/v1/cart/items')
        .send({ variantId, quantity: 1 })
        .expect(201);
      const cartId = guest.body.cartId as string;
      const tooSmall = await http()
        .post('/api/v1/cart/coupon')
        .set('X-Cart-Id', cartId)
        .send({ code })
        .expect(400);
      expect(tooSmall.body.message).toContain('Spend $80.00');
      await http()
        .patch(`/api/v1/cart/items/${variantId}`)
        .set('X-Cart-Id', cartId)
        .send({ quantity: 2 })
        .expect(200);
      const applied = await http()
        .post('/api/v1/cart/coupon')
        .set('X-Cart-Id', cartId)
        .send({ code: code.toLowerCase() })
        .expect(201);
      const cart = applied.body as Cart;
      expect(cart.coupon).toMatchObject({ code, problem: null });
      // $100 − 10% = $90 of goods: under $99, so $9.99 shipping; tax 6% of $90.
      expect(cart.totals).toMatchObject({ discountCents: 1000, shippingCents: 999 });
      const md = await http().get('/api/v1/cart?region=MD').set('X-Cart-Id', cartId).expect(200);
      expect(md.body.totals).toMatchObject({ taxCents: 540, totalCents: 9000 + 999 + 540 });

      // Dropping below the minimum keeps the code visible with the reason, and blocks checkout.
      await http()
        .patch(`/api/v1/cart/items/${variantId}`)
        .set('X-Cart-Id', cartId)
        .send({ quantity: 1 })
        .expect(200);
      const shrunk = await http().get('/api/v1/cart').set('X-Cart-Id', cartId).expect(200);
      expect(shrunk.body.coupon.problem).toContain('Spend');
      expect(shrunk.body.totals.discountCents).toBe(0);
      const blocked = await http()
        .post('/api/v1/checkout')
        .send({ cartId, email: `guest-${run}@example.com`, shippingAddress: address })
        .expect(409);
      expect(blocked.body.code).toBe('COUPON_INVALID');
      await http().delete('/api/v1/cart/coupon').set('X-Cart-Id', cartId).expect(200);
    });

    it('records the code on the order and enforces the redemption limit', async () => {
      const first = await buy(customerToken, 1, capped);
      const order = await adminOrder(first.orderId);
      expect(order).toMatchObject({ couponCode: capped, discountCents: 1500, subtotalCents: 5000 });
      expect(order.totalCents).toBe(3500 + 999 + 210);

      const other = await signUp(`second-${run}@example.com`);
      await http().post('/api/v1/cart/items').set(bearer(other)).send({ variantId }).expect(201);
      const used = await http()
        .post('/api/v1/cart/coupon')
        .set(bearer(other))
        .send({ code: capped })
        .expect(400);
      expect(used.body.message).toContain('fully used');
      await http().delete(`/api/v1/cart/items/${variantId}`).set(bearer(other)).expect(200);
    });
  });

  describe('wishlist', () => {
    it('saves, lists and removes products', async () => {
      await http().put(`/api/v1/me/wishlist/${productId}`).set(bearer(customerToken)).expect(204);
      await http().put(`/api/v1/me/wishlist/${productId}`).set(bearer(customerToken)).expect(204);
      const list = await http().get('/api/v1/me/wishlist').set(bearer(customerToken)).expect(200);
      expect(list.body.map((p: { id: string }) => p.id)).toEqual([productId]);
      await http()
        .delete(`/api/v1/me/wishlist/${productId}`)
        .set(bearer(customerToken))
        .expect(204);
      const ids = await http()
        .get('/api/v1/me/wishlist/ids')
        .set(bearer(customerToken))
        .expect(200);
      expect(ids.body).toEqual([]);
      await http().put(`/api/v1/me/wishlist/${productId}`).expect(401);
    });
  });

  describe('reviews', () => {
    it('publishes reviews only after moderation, marking verified buyers', async () => {
      await http()
        .post(`/api/v1/catalog/products/${productSlug}/reviews`)
        .send({ rating: 5, title: 'Great', body: 'Works with everything I plugged in.' })
        .expect(401);

      // Only after the product reached the customer: paid and shipped is not enough.
      const bought = await buy(customerToken, 1);
      const early = { rating: 5, title: 'Great', body: 'Works with everything I plugged in.' };
      const reviewUrl = `/api/v1/catalog/products/${productSlug}/reviews`;
      await http().post(reviewUrl).set(bearer(customerToken)).send(early).expect(403);
      const notYet = await http().get(`${reviewUrl}/mine`).set(bearer(customerToken)).expect(200);
      expect(notYet.body).toEqual({ review: null, canReview: false, helpfulVotes: [] });
      for (const action of ['start', 'ship'] as const) {
        await http()
          .post(`/api/v1/admin/orders/${bought.orderId}/fulfillment`)
          .set(bearer(staffToken))
          .send(
            action === 'ship'
              ? { action, carrier: 'UPS', trackingNumber: '1z999aa10123456784' }
              : { action },
          )
          .expect(200);
      }
      await http().post(reviewUrl).set(bearer(customerToken)).send(early).expect(403);
      await http()
        .post(`/api/v1/admin/orders/${bought.orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'deliver' })
        .expect(200);
      const ready = await http().get(`${reviewUrl}/mine`).set(bearer(customerToken)).expect(200);
      expect(ready.body.canReview).toBe(true);

      const posted = await http()
        .post(`/api/v1/catalog/products/${productSlug}/reviews`)
        .set(bearer(customerToken))
        .send({
          rating: 4,
          title: 'Solid hub',
          body: 'Works with my laptop and two monitors. Runs warm.',
        })
        .expect(201);
      expect(posted.body.status).toBe('PENDING');

      const before = await http()
        .get(`/api/v1/catalog/products/${productSlug}/reviews`)
        .expect(200);
      expect(before.body.summary.count).toBe(0);

      await http().get('/api/v1/admin/reviews').set(bearer(customerToken)).expect(403);
      const queue = await http().get('/api/v1/admin/reviews').set(bearer(staffToken)).expect(200);
      const mine = queue.body.items.find(
        (r: { product: { id: string } }) => r.product.id === productId,
      );
      expect(mine).toMatchObject({
        verifiedPurchase: true,
        author: 'Ada',
        authorEmail: customerEmail,
      });
      await http()
        .post(`/api/v1/admin/reviews/${mine.id}/moderation`)
        .set(bearer(staffToken))
        .send({ status: 'APPROVED' })
        .expect(200);

      const after = await http().get(`/api/v1/catalog/products/${productSlug}/reviews`).expect(200);
      expect(after.body.summary).toMatchObject({
        average: 4,
        count: 1,
        distribution: [0, 0, 0, 1, 0],
      });
      expect(after.body.reviews[0].author).toBe('Ada');
      // A star filter narrows the list but never the summary; unknown sorts are rejected.
      const fours = await http().get(`${reviewUrl}?rating=4&sort=lowest`).expect(200);
      expect(fours.body).toMatchObject({ total: 1, totalPages: 1 });
      const fives = await http().get(`${reviewUrl}?rating=5`).expect(200);
      expect(fives.body).toMatchObject({ total: 0, reviews: [], summary: { count: 1 } });
      await http().get(`${reviewUrl}?sort=random`).expect(400);
      expect(JSON.stringify(after.body)).not.toContain(customerEmail);
      const detail = await http().get(`/api/v1/catalog/products/${productSlug}`).expect(200);
      expect(detail.body.rating).toEqual({ average: 4, count: 1 });

      // Editing sends it back to moderation.
      await http()
        .post(`/api/v1/catalog/products/${productSlug}/reviews`)
        .set(bearer(customerToken))
        .send({
          rating: 2,
          title: 'Changed my mind',
          body: 'Stopped working with one monitor after a week.',
        })
        .expect(201);
      const hidden = await http()
        .get(`/api/v1/catalog/products/${productSlug}/reviews`)
        .expect(200);
      expect(hidden.body.summary.count).toBe(0);
    });
  });

  describe('refunds, labels and returns', () => {
    let order: CheckoutResponse;

    beforeAll(async () => {
      order = await buy(customerToken, 3);
    });

    it('issues a partial refund, then refuses more than what is left', async () => {
      const refunded = await http()
        .post(`/api/v1/admin/orders/${order.orderId}/refunds`)
        .set(bearer(staffToken))
        .send({ amountCents: 1000, reason: 'Box arrived dented' })
        .expect(200);
      expect(refunded.body).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedCents: 1000 });
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/refunds`)
        .set(bearer(staffToken))
        .send({ amountCents: refunded.body.totalCents, reason: 'Too much' })
        .expect(400);
      await outbox.drain();
      expect(mail.lastTo(customerEmail, 'orders.refunded')?.text).toContain('$10.00');
    });

    it('buys a postage label, which ships the order', async () => {
      // A partially refunded order can't take a label; use a fresh one.
      order = await buy(customerToken, 3);
      const shipped = await http()
        .post(`/api/v1/admin/orders/${order.orderId}/label`)
        .set(bearer(staffToken))
        .send({})
        .expect(200);
      expect(shipped.body.status).toBe('SHIPPED');
      expect(shipped.body.tracking.number).toMatch(/^9400\d{18}$/);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(row.postageCents).toBeGreaterThan(0);
      const label = await http()
        .get(new URL(row.labelUrl!).pathname + new URL(row.labelUrl!).search)
        .expect(200);
      expect(label.text).toContain(order.orderNumber);
      await http()
        .get(new URL(row.labelUrl!).pathname + '?sig=forged')
        .expect(404);
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/label`)
        .set(bearer(staffToken))
        .send({})
        .expect(409);
    });

    it('only accepts returns after delivery', async () => {
      const item = (await adminOrder(order.orderId)).items[0]!;
      await http()
        .post(`/api/v1/orders/${order.orderNumber}/returns?token=${order.accessToken}`)
        .send({ reason: 'DAMAGED', items: [{ orderItemId: item.id, quantity: 1 }] })
        .expect(409);
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'deliver' })
        .expect(200);
      const view = await http()
        .get(`/api/v1/orders/${order.orderNumber}?token=${order.accessToken}`)
        .expect(200);
      expect(view.body.returnableUntil).toBeTruthy();
    });

    it('runs a return from request to refund and restock', async () => {
      const item = (await adminOrder(order.orderId)).items[0]!;
      await http()
        .post(`/api/v1/orders/${order.orderNumber}/returns?token=${order.accessToken}`)
        .send({ reason: 'DAMAGED', items: [{ orderItemId: item.id, quantity: 4 }] })
        .expect(400);
      const requested = await http()
        .post(`/api/v1/orders/${order.orderNumber}/returns?token=${order.accessToken}`)
        .send({
          reason: 'DAMAGED',
          note: 'Cracked casing',
          items: [{ orderItemId: item.id, quantity: 2 }],
        })
        .expect(201);
      expect(requested.body).toMatchObject({ status: 'REQUESTED', reason: 'Arrived damaged' });
      await http()
        .post(`/api/v1/orders/${order.orderNumber}/returns?token=${order.accessToken}`)
        .send({ reason: 'OTHER', items: [{ orderItemId: item.id, quantity: 2 }] })
        .expect(400);

      const queue = await http()
        .get('/api/v1/admin/returns?status=REQUESTED')
        .set(bearer(staffToken))
        .expect(200);
      expect(queue.body.map((r: { id: string }) => r.id)).toContain(requested.body.id);
      await http()
        .post(`/api/v1/admin/returns/${requested.body.id}/decision`)
        .set(bearer(staffToken))
        .send({ action: 'receive' })
        .expect(409);
      await http()
        .post(`/api/v1/admin/returns/${requested.body.id}/decision`)
        .set(bearer(staffToken))
        .send({ action: 'approve' })
        .expect(200);

      const stockBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
      const received = await http()
        .post(`/api/v1/admin/returns/${requested.body.id}/decision`)
        .set(bearer(staffToken))
        .send({ action: 'receive', restock: true })
        .expect(200);
      // 2 × $50 plus 6% Maryland tax.
      expect(received.body).toMatchObject({ status: 'REFUNDED', refundCents: 10600 });
      const stockAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
      expect(stockAfter.onHand).toBe(stockBefore.onHand + 2);
      expect((await adminOrder(order.orderId)).status).toBe('PARTIALLY_REFUNDED');

      await outbox.drain();
      expect(mail.lastTo(customerEmail, 'orders.return_approved')?.text).toContain(
        'NIXZORA Returns',
      );
      expect(mail.lastTo(customerEmail, 'orders.refunded')?.text).toContain('$106.00');
    });
  });

  describe('customer support', () => {
    it('keeps private notes and shows a customer’s orders to staff', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
      await http()
        .post(`/api/v1/admin/users/${user.id}/notes`)
        .set(bearer(customerToken))
        .send({ body: 'nope' })
        .expect(403);
      await http()
        .post(`/api/v1/admin/users/${user.id}/notes`)
        .set(bearer(staffToken))
        .send({ body: 'Called about the dented box; refunded $10.' })
        .expect(201);
      const notes = await http()
        .get(`/api/v1/admin/users/${user.id}/notes`)
        .set(bearer(staffToken))
        .expect(200);
      expect(notes.body[0]).toMatchObject({ authorEmail: `ops-admin-${run}@example.com` });
      const orders = await http()
        .get(`/api/v1/admin/users/${user.id}/orders`)
        .set(bearer(staffToken))
        .expect(200);
      expect(orders.body.length).toBeGreaterThanOrEqual(3);
    });
  });
});
