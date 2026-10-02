import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';
process.env.TAX_RATES_BPS = 'MD:600';
process.env.SHIPPING_FLAT_CENTS = '999';
process.env.FREE_SHIPPING_THRESHOLD_CENTS = '9900';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type Cart, type CheckoutResponse } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { MailService } from '../src/modules/notifications/mail.service';
import { OrdersService } from '../src/modules/orders/orders.service';
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

describe('Cart, checkout, payments and fulfillment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let mail: MailService;
  let orders: OrdersService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** $49.00, 3 in stock. */
  let cheapId: string;
  /** $120.00, 10 in stock (free shipping on its own). */
  let pricyId: string;
  let staffToken: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function stock(variantId: string) {
    return prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
  }

  async function pay(checkout: CheckoutResponse, outcome = 'succeeded') {
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome })
      .expect(200);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    mail = app.get(MailService);
    orders = app.get(OrdersService);

    const category = await prisma.category.create({
      data: { name: `Checkout ${run}`, slug: `checkout-${run}`, isActive: false },
    });
    const product = await prisma.product.create({
      data: {
        title: `Test Dock ${run}`,
        slug: `test-dock-${run}`,
        description: 'A dock used by the checkout tests.',
        status: 'ACTIVE',
        categoryId: category.id,
        variants: {
          create: [
            {
              sku: `DOCK-A-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 4900,
              inventory: { create: { onHand: 3 } },
            },
            {
              sku: `DOCK-B-${run}`.toUpperCase(),
              title: 'Pro',
              priceCents: 12000,
              inventory: { create: { onHand: 10 } },
            },
          ],
        },
      },
      include: { variants: { orderBy: { priceCents: 'asc' } } },
    });
    cheapId = product.variants[0]!.id;
    pricyId = product.variants[1]!.id;

    const staffEmail = `ops-${run}@example.com`;
    staffToken = await signUp(staffEmail);
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    await prisma.userRole.create({
      data: { user: { connect: { id: staff.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staffToken)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staffToken))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
  });

  afterAll(async () => {
    await removeTestData(app.get(PrismaService), run);
    await app.close();
  }, 30_000);

  describe('guest cart', () => {
    it('starts empty and creates a cart id on the first add', async () => {
      const empty = await http().get('/api/v1/cart').expect(200);
      expect(empty.body).toMatchObject({ cartId: null, itemCount: 0 });

      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: cheapId, quantity: 1 })
        .expect(201);
      const cart = added.body as Cart;
      expect(cart.cartId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(cart.totals).toMatchObject({
        subtotalCents: 4900,
        shippingCents: 999,
        freeShippingRemainingCents: 5000,
      });
    });

    it('refuses bad cart ids and unknown products', async () => {
      await http().get('/api/v1/cart').set('X-Cart-Id', '../../etc').expect(400);
      await http()
        .post('/api/v1/cart/items')
        .send({ variantId: '00000000-0000-7000-8000-000000000000' })
        .expect(404);
    });

    it('prices on the server, adds tax for Maryland and ships free over $99', async () => {
      const first = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: pricyId })
        .expect(201);
      const cartId = first.body.cartId as string;
      const md = await http().get('/api/v1/cart?region=MD').set('X-Cart-Id', cartId).expect(200);
      expect(md.body.totals).toEqual({
        currency: 'USD',
        subtotalCents: 12000,
        discountCents: 0,
        shippingCents: 0,
        taxCents: 720,
        totalCents: 12720,
        freeShippingRemainingCents: 0,
      });
      const va = await http().get('/api/v1/cart?region=VA').set('X-Cart-Id', cartId).expect(200);
      expect(va.body.totals.taxCents).toBe(0);
    });

    it('flags lines that exceed stock and blocks checkout until fixed', async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: cheapId, quantity: 5 })
        .expect(201);
      const cartId = added.body.cartId as string;
      expect(added.body.lines[0].problem).toBe('INSUFFICIENT_STOCK');
      const res = await http()
        .post('/api/v1/checkout')
        .send({ cartId, email: `guest-${run}@example.com`, shippingAddress: address })
        .expect(409);
      expect(res.body.code).toBe('CART_CHANGED');
    });
  });

  describe('guest checkout', () => {
    let cartId: string;
    let checkout: CheckoutResponse;

    it('creates a pending order, holds stock and returns a payment session', async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: cheapId, quantity: 2 })
        .expect(201);
      cartId = added.body.cartId;

      const res = await http()
        .post('/api/v1/checkout')
        .send({ cartId, email: ` Guest-${run}@Example.com `, shippingAddress: address })
        .expect(201);
      checkout = res.body as CheckoutResponse;
      expect(checkout.orderNumber).toMatch(/^NX-[A-Z0-9]{6}$/);
      expect(checkout.payment).toMatchObject({ provider: 'FAKE', amountCents: 9800 + 999 + 588 });
      expect(checkout.totals).toMatchObject({
        subtotalCents: 9800,
        shippingCents: 999,
        taxCents: 588,
      });
      expect(await stock(cheapId)).toMatchObject({ onHand: 3, reserved: 2 });

      const order = await http()
        .get(`/api/v1/orders/${checkout.orderNumber}?token=${checkout.accessToken}`)
        .expect(200);
      expect(order.body).toMatchObject({
        status: 'PENDING_PAYMENT',
        email: `guest-${run}@example.com`,
      });
    });

    it('only shows the order with the signed link', async () => {
      await http().get(`/api/v1/orders/${checkout.orderNumber}`).expect(400);
      await http()
        .get(`/api/v1/orders/${checkout.orderNumber}?token=${'x'.repeat(43)}`)
        .expect(404);
      await http().get('/api/v1/orders/not-a-number?token=abc').expect(400);
    });

    it('becomes paid on the payment event, takes stock, empties the cart and emails a receipt', async () => {
      await pay(checkout);
      const order = await http()
        .get(`/api/v1/orders/${checkout.orderNumber}?token=${checkout.accessToken}`)
        .expect(200);
      expect(order.body.status).toBe('PAID');
      expect(order.body.timeline.map((t: { status: string }) => t.status)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
      ]);
      expect(await stock(cheapId)).toMatchObject({ onHand: 1, reserved: 0 });

      const cart = await http().get('/api/v1/cart').set('X-Cart-Id', cartId).expect(200);
      expect(cart.body.itemCount).toBe(0);

      await outbox.drain();
      const receipt = mail.lastTo(`guest-${run}@example.com`, 'orders.receipt');
      expect(receipt?.subject).toContain(checkout.orderNumber);
      expect(receipt?.text).toContain(`token=${checkout.accessToken}`);
    });

    it('ignores a replayed payment event', async () => {
      const payment = await prisma.payment.findFirstOrThrow({
        where: { order: { number: checkout.orderNumber } },
      });
      const event = {
        id: `evt-replay-${run}`,
        type: 'succeeded' as const,
        paymentId: payment.providerPaymentId,
        amountCents: payment.amountCents,
        currency: 'USD',
      };
      expect(await orders.applyPaymentEvent(event)).toBe('applied');
      expect(await orders.applyPaymentEvent(event)).toBe('duplicate');
      expect(await stock(cheapId)).toMatchObject({ onHand: 1, reserved: 0 });
    });

    it('refuses a payment session for a paid order', async () => {
      const res = await http()
        .post(`/api/v1/orders/${checkout.orderNumber}/payment?token=${checkout.accessToken}`)
        .expect(409);
      expect(res.body.code).toBe('ORDER_NOT_PAYABLE');
    });
  });

  describe('failed and abandoned payments', () => {
    it('keeps the order payable after a decline, and releases stock when cancelled', async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: pricyId })
        .expect(201);
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .send({
            cartId: added.body.cartId,
            email: `decline-${run}@example.com`,
            shippingAddress: address,
          })
          .expect(201)
      ).body as CheckoutResponse;
      expect((await stock(pricyId)).reserved).toBe(1);

      await pay(checkout, 'failed');
      const again = await http()
        .post(`/api/v1/orders/${checkout.orderNumber}/payment?token=${checkout.accessToken}`)
        .expect(200);
      expect(again.body.clientSecret).toBe(checkout.payment.clientSecret);

      await pay(checkout, 'canceled');
      const order = await http()
        .get(`/api/v1/orders/${checkout.orderNumber}?token=${checkout.accessToken}`)
        .expect(200);
      expect(order.body.status).toBe('CANCELLED');
      expect((await stock(pricyId)).reserved).toBe(0);
    });

    it('cannot use the Stripe webhook while the test gateway is active', async () => {
      await http().post('/api/v1/payments/webhooks/stripe').send({}).expect(403);
    });
  });

  describe('signed-in customer', () => {
    let token: string;
    let number: string;

    it('merges the guest cart on sign-in and saves the address at checkout', async () => {
      token = await signUp(`buyer-${run}@example.com`);
      const guest = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: pricyId })
        .expect(201);
      const merged = await http()
        .post('/api/v1/cart/merge')
        .set(bearer(token))
        .send({ guestCartId: guest.body.cartId })
        .expect(201);
      expect(merged.body).toMatchObject({ cartId: null, itemCount: 1 });

      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .set(bearer(token))
          .send({
            email: `ignored-${run}@example.com`,
            shippingAddress: address,
            saveAddress: true,
          })
          .expect(201)
      ).body as CheckoutResponse;
      number = checkout.orderNumber;
      await pay(checkout);

      const addresses = await http().get('/api/v1/me/addresses').set(bearer(token)).expect(200);
      expect(addresses.body).toHaveLength(1);
      expect(addresses.body[0]).toMatchObject({ city: 'Brandywine', isDefaultShipping: true });
    });

    it('sees the order in their account, uses the account email, and nobody else can', async () => {
      const list = await http().get('/api/v1/me/orders').set(bearer(token)).expect(200);
      expect(list.body[0]).toMatchObject({ number, status: 'PAID', itemCount: 1 });
      const order = await http().get(`/api/v1/me/orders/${number}`).set(bearer(token)).expect(200);
      expect(order.body.email).toBe(`buyer-${run}@example.com`);

      const other = await signUp(`other-${run}@example.com`);
      await http().get(`/api/v1/me/orders/${number}`).set(bearer(other)).expect(404);
      await http().get(`/api/v1/orders/${number}`).set(bearer(other)).expect(404);
    });

    it('manages the address book', async () => {
      const created = await http()
        .post('/api/v1/me/addresses')
        .set(bearer(token))
        .send({ ...address, line1: '2 Second St', label: 'Work', isDefaultShipping: true })
        .expect(201);
      const list = await http().get('/api/v1/me/addresses').set(bearer(token)).expect(200);
      expect(list.body.map((a: { id: string }) => a.id)[0]).toBe(created.body.id);
      await http()
        .post('/api/v1/me/addresses')
        .set(bearer(token))
        .send({ ...address, region: 'ON' })
        .expect(400);
      await http().delete(`/api/v1/me/addresses/${created.body.id}`).set(bearer(token)).expect(204);
      const other = await signUp(`other2-${run}@example.com`);
      await http().delete(`/api/v1/me/addresses/${list.body[1].id}`).set(bearer(other)).expect(404);
    });

    it('keeps the Ops Center order tools for staff', async () => {
      await http().get('/api/v1/admin/orders').set(bearer(token)).expect(403);
    });
  });

  describe('fulfillment in the Ops Center', () => {
    let orderId: string;
    let number: string;
    const email = `ship-${run}@example.com`;

    beforeAll(async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: pricyId, quantity: 2 })
        .expect(201);
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .send({ cartId: added.body.cartId, email, shippingAddress: address })
          .expect(201)
      ).body as CheckoutResponse;
      orderId = checkout.orderId;
      number = checkout.orderNumber;
      await pay(checkout);
    });

    it('lists and finds orders', async () => {
      const list = await http()
        .get(`/api/v1/admin/orders?q=${number}`)
        .set(bearer(staffToken))
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({ number, email, status: 'PAID' });
    });

    it('ships with tracking and emails the customer', async () => {
      await http()
        .post(`/api/v1/admin/orders/${orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'deliver' })
        .expect(409);
      await http()
        .post(`/api/v1/admin/orders/${orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'start' })
        .expect(200);
      const shipped = await http()
        .post(`/api/v1/admin/orders/${orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'ship', carrier: 'UPS', trackingNumber: '1z999aa10123456784' })
        .expect(200);
      expect(shipped.body.status).toBe('SHIPPED');
      expect(shipped.body.tracking).toMatchObject({ carrier: 'UPS', number: '1Z999AA10123456784' });
      expect(shipped.body.tracking.url).toContain('ups.com');

      await outbox.drain();
      expect(mail.lastTo(email, 'orders.shipped')?.text).toContain('1Z999AA10123456784');

      await http()
        .post(`/api/v1/admin/orders/${orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'cancel', reason: 'Too late' })
        .expect(409);
    });

    it('cancels a paid order with a full refund and puts the units back', async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: pricyId, quantity: 3 })
        .expect(201);
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .send({ cartId: added.body.cartId, email, shippingAddress: address })
          .expect(201)
      ).body as CheckoutResponse;
      await pay(checkout);
      const before = (await stock(pricyId)).onHand;

      const res = await http()
        .post(`/api/v1/admin/orders/${checkout.orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'cancel', reason: 'Customer asked to cancel' })
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect((await stock(pricyId)).onHand).toBe(before + 3);
      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: checkout.orderId },
        include: { refunds: true },
      });
      expect(payment.status).toBe('REFUNDED');
      expect(payment.refunds[0]?.amountCents).toBe(payment.amountCents);

      await outbox.drain();
      expect(mail.lastTo(email, 'orders.cancelled')?.subject).toContain(checkout.orderNumber);
    });
  });
});
