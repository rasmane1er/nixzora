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
  type CheckoutResponse,
  type OrderView,
  type SellerBalance,
  type SellerOrderView,
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
  fullName: 'Grace Hopper',
  line1: '1 Navy Way',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
  phone: '3015550199',
};

describe('Marketplace orders: split, shipping, commission and earnings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let staffToken: string;
  let sellerToken: string;
  let customerToken: string;
  let sellerId: string;
  /** $100.00, sold by the seller */
  let sellerVariant: string;
  /** $50.00, sold by NIXZORA */
  let ownVariant: string;
  const customerEmail = `mkt-buyer-${run}@example.com`;
  const sellerEmail = `mkt-store-${run}@example.com`;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function buy(lines: { variantId: string; quantity: number }[]): Promise<CheckoutResponse> {
    for (const line of lines) {
      await http().post('/api/v1/cart/items').set(bearer(customerToken)).send(line).expect(201);
    }
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(customerToken))
        .send({ email: customerEmail, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    return checkout;
  }

  const adminOrder = async (id: string) =>
    (await http().get(`/api/v1/admin/orders/${id}`).set(bearer(staffToken)).expect(200))
      .body as OrderView;
  const sellerOrders = async () =>
    (await http().get('/api/v1/seller/orders').set(bearer(sellerToken)).expect(200)).body
      .items as SellerOrderView[];
  const balance = async () =>
    (await http().get('/api/v1/seller/balance').set(bearer(sellerToken)).expect(200))
      .body as SellerBalance;
  const fulfill = (id: string, body: object, status = 200) =>
    http()
      .post(`/api/v1/admin/orders/${id}/fulfillment`)
      .set(bearer(staffToken))
      .send(body)
      .expect(status);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    mail = app.get(MailService);

    // Staff with MFA.
    const staffEmail = `mkt-ops-${run}@example.com`;
    staffToken = await signUp(staffEmail);
    await prisma.userRole.create({
      data: {
        user: { connect: { email: staffEmail } },
        role: { connect: { key: 'admin' } },
      },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staffToken)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staffToken))
      .send({ code: totp(setup.body.secret) })
      .expect(201);

    // An approved store with test-mode payouts, and one live listing.
    sellerToken = await signUp(sellerEmail);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: sellerEmail } });
    const seller = await prisma.seller.create({
      data: {
        handle: `copper-${run}`,
        displayName: 'Copperline',
        legalName: 'Copperline LLC',
        contactEmail: sellerEmail,
        status: 'ACTIVE',
        payoutProvider: 'FAKE',
        payoutAccountId: `fake_acct_${run}`,
        detailsSubmitted: true,
        payoutsEnabled: true,
        members: { create: { userId: owner.id } },
      },
    });
    sellerId = seller.id;
    const category = await prisma.category.create({
      data: { name: `Amps ${run}`, slug: `amps-${run}` },
    });
    const product = (title: string, sku: string, priceCents: number, sellerOf?: string) =>
      prisma.product.create({
        data: {
          title,
          slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${run}`,
          description: 'Test product.',
          status: 'ACTIVE',
          categoryId: category.id,
          sellerId: sellerOf ?? null,
          variants: {
            create: [
              {
                sku: `${sku}-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents,
                inventory: { create: { onHand: 20 } },
              },
            ],
          },
        },
        include: { variants: true },
      });
    sellerVariant = (await product('Tube amp', 'AMP', 10000, seller.id)).variants[0]!.id;
    ownVariant = (await product('Speaker cable', 'CBL', 5000)).variants[0]!.id;
    customerToken = await signUp(customerEmail);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  describe('a mixed order', () => {
    let order: CheckoutResponse;
    let part: SellerOrderView;

    it('splits the seller part out with its commission when paid, and emails the store', async () => {
      order = await buy([
        { variantId: sellerVariant, quantity: 2 },
        { variantId: ownVariant, quantity: 1 },
      ]);
      part = (await sellerOrders())[0]!;
      expect(part).toMatchObject({
        orderNumber: order.orderNumber,
        status: 'PAID',
        itemsCents: 20000,
        shippingCents: 0, // free shipping over $99
        commissionBps: 1200,
        commissionCents: 2400,
        netCents: 17600,
        shipTo: { fullName: 'Grace Hopper', postalCode: '20613' },
      });
      expect(part.items.map((i) => i.quantity)).toEqual([2]);
      // Sellers see where to ship, never the customer's email or phone.
      expect(JSON.stringify(part)).not.toContain(customerEmail);
      expect(JSON.stringify(part)).not.toContain('3015550199');
      expect(await balance()).toMatchObject({
        pendingCents: 17600,
        onHoldCents: 0,
        availableCents: 0,
      });

      await outbox.drain();
      expect(mail.lastTo(sellerEmail, 'sellers.new-order')?.text).toContain('$176.00');
    });

    it('stays "fulfilling" until every part has shipped', async () => {
      // NIXZORA ships its own item first.
      const afterOwn = (
        await fulfill(order.orderId, {
          action: 'ship',
          carrier: 'USPS',
          trackingNumber: `9400${run}0001`,
        })
      ).body as OrderView;
      expect(afterOwn.status).toBe('FULFILLING');
      expect(afterOwn.shipments.map((s) => [s.seller?.displayName ?? 'NIXZORA', s.status])).toEqual(
        [
          ['NIXZORA', 'SHIPPED'],
          ['Copperline', 'PROCESSING'],
        ],
      );
      await fulfill(
        order.orderId,
        { action: 'ship', carrier: 'USPS', trackingNumber: `9400${run}0002` },
        409,
      );

      // Another store cannot ship it.
      const otherToken = await signUp(`mkt-other-${run}@example.com`);
      await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(otherToken))
        .send({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' })
        .expect(403);

      const shipped = await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'UPS', trackingNumber: '1z999aa10123456784' })
        .expect(200);
      expect(shipped.body).toMatchObject({
        status: 'SHIPPED',
        tracking: { carrier: 'UPS', number: '1Z999AA10123456784' },
      });
      await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' })
        .expect(409);

      const view = await adminOrder(order.orderId);
      expect(view.status).toBe('SHIPPED');
      await outbox.drain();
      const email = mail.lastTo(customerEmail, 'orders.shipped')!.text;
      expect(email).toContain('From Copperline: UPS tracking number 1Z999AA10123456784');
      expect(email).toContain(`From NIXZORA: USPS tracking number 9400${run.toUpperCase()}0001`);
    });

    it('credits the seller on shipping, held for the store hold period', async () => {
      const now = Date.now();
      const money = await balance();
      expect(money).toMatchObject({
        pendingCents: 0,
        onHoldCents: 17600,
        availableCents: 0,
        lifetimeNetCents: 17600,
      });
      const release = Date.parse(money.nextReleaseAt!);
      expect(release - now).toBeGreaterThan(13.9 * 86_400_000);
      expect(release - now).toBeLessThan(14.1 * 86_400_000);
    });

    it('marks the seller part delivered with the order, and debits refunds of its items', async () => {
      await fulfill(order.orderId, { action: 'deliver' });
      expect((await sellerOrders())[0]!.status).toBe('DELIVERED');

      // One unit of the seller's amp comes back: $100 refunded, the 12% commission returned.
      const item = (await adminOrder(order.orderId)).items.find((i) => i.sku.startsWith('AMP'))!;
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/refunds`)
        .set(bearer(staffToken))
        .send({
          amountCents: 10000,
          reason: 'Returned',
          restock: [{ orderItemId: item.id, quantity: 1 }],
        })
        .expect(200);
      expect(await balance()).toMatchObject({
        onHoldCents: 17600,
        availableCents: -8800,
        lifetimeNetCents: 8800,
      });
      expect((await sellerOrders())[0]!.refundedCents).toBe(10000);

      const ledger = (
        await http().get('/api/v1/seller/ledger').set(bearer(sellerToken)).expect(200)
      ).body;
      expect(
        ledger.items.map((e: { type: string; amountCents: number }) => [e.type, e.amountCents]),
      ).toEqual([
        ['REFUND', -8800],
        ['SALE', 17600],
      ]);
    });

    it('does not charge the seller for a refund of NIXZORA-only items', async () => {
      const cable = (await adminOrder(order.orderId)).items.find((i) => i.sku.startsWith('CBL'))!;
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/refunds`)
        .set(bearer(staffToken))
        .send({
          amountCents: 5000,
          reason: 'Cable returned',
          restock: [{ orderItemId: cable.id, quantity: 1 }],
        })
        .expect(200);
      expect((await balance()).availableCents).toBe(-8800);
    });
  });

  describe('an order sold only by the seller', () => {
    it('cannot be shipped or labelled by NIXZORA, and cancelling it cancels the seller part', async () => {
      const order = await buy([{ variantId: sellerVariant, quantity: 1 }]);
      await fulfill(
        order.orderId,
        { action: 'ship', carrier: 'UPS', trackingNumber: '1Z999AA10123456785' },
        409,
      );
      await http()
        .post(`/api/v1/admin/orders/${order.orderId}/label`)
        .set(bearer(staffToken))
        .send({})
        .expect(409);

      const part = (await sellerOrders()).find((p) => p.orderNumber === order.orderNumber)!;
      expect(part).toMatchObject({
        status: 'PAID',
        shippingCents: 0,
        netCents: 10000 - 1200,
      });
      await fulfill(order.orderId, { action: 'cancel', reason: 'Customer changed their mind' });
      const after = (await sellerOrders()).find((p) => p.orderNumber === order.orderNumber)!;
      expect(after.status).toBe('CANCELLED');
      await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'UPS', trackingNumber: '1Z999AA10123456785' })
        .expect(409);
      // Nothing was earned, nothing is owed.
      expect((await balance()).pendingCents).toBe(0);
    });

    it('cannot be cancelled once the seller has shipped', async () => {
      const order = await buy([{ variantId: sellerVariant, quantity: 1 }]);
      const part = (await sellerOrders()).find((p) => p.orderNumber === order.orderNumber)!;
      await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'FedEx', trackingNumber: '123456789012' })
        .expect(200);
      expect((await adminOrder(order.orderId)).status).toBe('SHIPPED');
      await fulfill(order.orderId, { action: 'cancel', reason: 'Too late' }, 409);
      const staffView = (
        await http()
          .get(`/api/v1/admin/sellers/${sellerId}/balance`)
          .set(bearer(staffToken))
          .expect(200)
      ).body as SellerBalance;
      expect(staffView.onHoldCents).toBe(17600 + 8800);
    });
  });
});
