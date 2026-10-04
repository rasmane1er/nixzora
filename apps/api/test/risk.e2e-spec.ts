import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';
process.env.TAX_RATES_BPS = 'MD:600';
process.env.SHIPPING_FLAT_CENTS = '999';
process.env.FREE_SHIPPING_THRESHOLD_CENTS = '9900';
process.env.RISK_CHECKS = 'enforce';
process.env.INTERNAL_API_KEY = 'r'.repeat(48);

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type CheckoutResponse,
  type PagedResult,
  type RiskAssessmentView,
  type SellerBalance,
  type SellerOrderView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { MailService } from '../src/modules/notifications/mail.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { RiskService } from '../src/modules/risk/risk.service';
import { PayoutsService } from '../src/modules/sellers/payouts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Alan Turing',
  line1: '2 Bletchley Rd',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

describe('Fraud signals on checkout and payouts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** A public address unique to this run (TEST-NET-3), sent the way the storefront does. */
  const ip = `203.0.113.${(Date.now() % 250) + 1}`;
  const fromShopper = { 'X-Internal-Key': process.env.INTERNAL_API_KEY!, 'X-Client-IP': ip };

  let staffToken: string;
  let customerToken: string;
  let sellerToken: string;
  let sellerId: string;
  /** $20.00, NIXZORA's own. */
  let cheapId: string;
  /** $120.00, sold by the test store. */
  let storeVariantId: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function guestCheckout(
    email: string,
    variantId: string,
    quantity = 1,
    headers: Record<string, string> = {},
    status = 201,
  ) {
    const added = await http().post('/api/v1/cart/items').send({ variantId, quantity }).expect(201);
    return http()
      .post('/api/v1/checkout')
      .set(headers)
      .send({ cartId: added.body.cartId, email, shippingAddress: address })
      .expect(status);
  }

  const pay = (checkout: CheckoutResponse, outcome = 'succeeded', riskLevel?: string) =>
    http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome, riskLevel })
      .expect(200);

  const reviews = async (query: string) =>
    (await http().get(`/api/v1/admin/risk?${query}`).set(bearer(staffToken)).expect(200))
      .body as PagedResult<RiskAssessmentView>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    mail = app.get(MailService);

    const staffEmail = `risk-ops-${run}@example.com`;
    staffToken = await signUp(staffEmail);
    await prisma.userRole.create({
      data: { user: { connect: { email: staffEmail } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staffToken)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staffToken))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    customerToken = await signUp(`risk-customer-${run}@example.com`);

    const sellerEmail = `risk-store-${run}@example.com`;
    sellerToken = await signUp(sellerEmail);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: sellerEmail } });
    const seller = await prisma.seller.create({
      data: {
        handle: `riskstore-${run}`,
        displayName: 'Risky Business',
        legalName: 'Risky Business LLC',
        contactEmail: sellerEmail,
        status: 'ACTIVE',
        approvedAt: new Date(Date.now() - 200 * 86_400_000),
        payoutProvider: 'FAKE',
        payoutAccountId: `fake_acct_risk_${run}`,
        detailsSubmitted: true,
        payoutsEnabled: true,
        members: { create: { userId: owner.id } },
      },
    });
    sellerId = seller.id;

    const category = await prisma.category.create({
      data: { name: `Risk ${run}`, slug: `risk-${run}`, isActive: false },
    });
    const product = async (title: string, sku: string, priceCents: number, store?: string) =>
      (
        await prisma.product.create({
          data: {
            title,
            slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${run}`,
            description: 'Test product.',
            status: 'ACTIVE',
            categoryId: category.id,
            sellerId: store ?? null,
            variants: {
              create: [
                {
                  sku: `${sku}-${run}`.toUpperCase(),
                  title: 'Standard',
                  priceCents,
                  inventory: { create: { onHand: 200 } },
                },
              ],
            },
          },
          include: { variants: true },
        })
      ).variants[0]!.id;
    cheapId = await product('Gift card sleeve', 'SLV', 2000);
    storeVariantId = await product('Camera lens', 'LNS', 12000, seller.id);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  it('keeps fraud reviews to staff', async () => {
    await http().get('/api/v1/admin/risk').set(bearer(customerToken)).expect(403);
  });

  describe('card testing', () => {
    it('lets the first attempts through, then declines the next checkout from that address', async () => {
      // Five failed cards from five "different" shoppers: the fifth is already held for review.
      for (let i = 0; i < 5; i++) {
        const res = await guestCheckout(`tester${i}-${run}@example.com`, cheapId, 1, fromShopper);
        await pay(res.body as CheckoutResponse, 'failed');
      }
      const declined = await guestCheckout(
        `tester9-${run}@example.com`,
        cheapId,
        1,
        fromShopper,
        403,
      );
      expect(declined.body).toMatchObject({ code: 'ORDER_DECLINED' });
      expect(declined.body.message).toMatch(/could not accept this order/);

      const row = await prisma.riskAssessment.findFirstOrThrow({
        where: { email: `tester9-${run}@example.com` },
      });
      expect(row).toMatchObject({ decision: 'BLOCK', orderId: null, status: null, ipAddress: ip });
      expect((row.signals as { code: string }[]).map((s) => s.code)).toEqual(
        expect.arrayContaining(['ip_velocity', 'emails_per_ip', 'failed_payments']),
      );
      // The fifth attempt was held, but it was never paid: nothing for a reviewer to do.
      const held = await prisma.order.findFirstOrThrow({
        where: { email: `tester4-${run}@example.com` },
      });
      expect(held.riskHold).toBe(true);
      const queue = await reviews('status=OPEN');
      expect(queue.items.some((r) => r.order?.id === held.id)).toBe(false);
      // No stock was held for it.
      expect(await prisma.order.count({ where: { email: `tester9-${run}@example.com` } })).toBe(0);
    });

    it('says so in the shopper’s language', async () => {
      const added = await http()
        .post('/api/v1/cart/items')
        .send({ variantId: cheapId })
        .expect(201);
      const res = await http()
        .post('/api/v1/checkout')
        .set(fromShopper)
        .set('Accept-Language', 'es')
        .send({
          cartId: added.body.cartId,
          email: `tester10-${run}@example.com`,
          shippingAddress: address,
        })
        .expect(403);
      expect(res.body.message).toMatch(/No pudimos aceptar este pedido/);
    });

    it('does not judge shoppers behind local addresses by IP (tests, internal calls)', async () => {
      await guestCheckout(`local-${run}@example.com`, cheapId);
    });
  });

  describe('an order held for review', () => {
    let checkout: CheckoutResponse;
    let part: SellerOrderView;

    it('holds a large bulk order from a throwaway inbox, but takes the payment', async () => {
      const res = await guestCheckout(`bulk-${run}@mailinator.com`, storeVariantId, 10);
      checkout = res.body as CheckoutResponse;
      const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } });
      expect(order.riskHold).toBe(true);
      await pay(checkout);

      const open = await reviews(`status=OPEN&orderId=${checkout.orderId}`);
      expect(open.items).toHaveLength(1);
      expect(open.items[0]).toMatchObject({
        subject: 'CHECKOUT',
        decision: 'REVIEW',
        score: 50,
        order: { number: checkout.orderNumber, status: 'PAID', riskHold: true },
      });
      expect(open.items[0]!.signals.map((s) => s.code)).toEqual([
        'guest_high_value',
        'bulk_quantity',
        'disposable_email',
      ]);
    });

    it('stops the store from shipping it until it is cleared', async () => {
      await outbox.drain();
      const email = mail.lastTo(`risk-store-${run}@example.com`, 'sellers.new-order');
      expect(email?.subject).toContain('on hold, do not ship yet');
      expect(email?.text).toMatch(/^We are checking this order before it ships/);
      const orders = (
        await http().get('/api/v1/seller/orders').set(bearer(sellerToken)).expect(200)
      ).body as { items: SellerOrderView[] };
      part = orders.items.find((o) => o.orderNumber === checkout.orderNumber)!;
      expect(part.underReview).toBe(true);
      const ship = await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' })
        .expect(409);
      expect(ship.body.message).toBe('This order is being reviewed. Do not ship it yet.');
    });

    it('a reviewer clears it, and it ships', async () => {
      const [review] = (await reviews(`status=OPEN&orderId=${checkout.orderId}`)).items;
      const cleared = await http()
        .post(`/api/v1/admin/risk/${review!.id}/review`)
        .set(bearer(staffToken))
        .send({ outcome: 'clear', note: 'Called the customer: a school buying for a class.' })
        .expect(200);
      expect(cleared.body).toMatchObject({
        status: 'CLEARED',
        reviewedBy: `risk-ops-${run}@example.com`,
        order: { riskHold: false },
      });
      await outbox.drain();
      expect(mail.lastTo(`risk-store-${run}@example.com`, 'sellers.order-cleared')?.subject).toBe(
        `Order ${checkout.orderNumber} is cleared: ship it now`,
      );
      await http()
        .post(`/api/v1/seller/orders/${part.id}/ship`)
        .set(bearer(sellerToken))
        .send({ carrier: 'UPS', trackingNumber: '1Z999AA10123456784' })
        .expect(200);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'risk.cleared', entityId: checkout.orderId },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('the card network says the payment is risky', () => {
    const email = `radar-${run}@example.com`;
    let checkout: CheckoutResponse;

    it('holds an order whose card Stripe Radar rates highest risk', async () => {
      checkout = (await guestCheckout(email, cheapId, 2)).body as CheckoutResponse;
      await pay(checkout, 'succeeded', 'highest');
      const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } });
      expect(order).toMatchObject({ status: 'PAID', riskHold: true });
      await http()
        .post(`/api/v1/admin/orders/${checkout.orderId}/fulfillment`)
        .set(bearer(staffToken))
        .send({ action: 'start' })
        .expect(409);
    });

    it('confirming fraud cancels and refunds the order, and declines that email next time', async () => {
      const [review] = (await reviews(`status=OPEN&orderId=${checkout.orderId}`)).items;
      expect(review!.signals.map((s) => s.code)).toEqual(['radar_highest']);
      await http()
        .post(`/api/v1/admin/risk/${review!.id}/review`)
        .set(bearer(staffToken))
        .send({ outcome: 'confirm' })
        .expect(200);
      const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } });
      expect(order.status).toBe('CANCELLED');
      expect(order.refundedCents).toBe(order.totalCents);

      const again = await guestCheckout(email, cheapId, 1, {}, 403);
      expect(again.body.code).toBe('ORDER_DECLINED');
    });
  });

  describe('a chargeback', () => {
    let checkout: CheckoutResponse;

    it('opens a review and pauses the store’s payouts', async () => {
      checkout = (await guestCheckout(`dispute-${run}@example.com`, storeVariantId)).body;
      await pay(checkout);
      await pay(checkout, 'disputed');

      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: checkout.orderId },
      });
      expect(payment.disputedAt).not.toBeNull();
      const chargeback = await reviews(`subject=CHARGEBACK&orderId=${checkout.orderId}`);
      expect(chargeback.items[0]).toMatchObject({ status: 'OPEN', score: 100 });

      const seller = await prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.payoutsHeld).toBe(true);
      const balance = (
        await http().get('/api/v1/seller/balance').set(bearer(sellerToken)).expect(200)
      ).body as SellerBalance;
      expect(balance.payoutsPaused).toBe(true);
      await expect(app.get(PayoutsService).payOut(sellerId)).rejects.toThrow(
        'Payouts for this store are on hold while we review recent activity.',
      );
    });

    it('clearing the store’s review restarts payouts, and the same facts do not hold it again', async () => {
      const [review] = (await reviews(`subject=PAYOUT&status=OPEN&sellerId=${sellerId}`)).items;
      expect(review!.signals.map((s) => s.code)).toContain('store_chargebacks');
      await http()
        .post(`/api/v1/admin/risk/${review!.id}/review`)
        .set(bearer(staffToken))
        .send({ outcome: 'clear', note: 'Customer withdrew the dispute.' })
        .expect(200);
      expect((await prisma.seller.findUniqueOrThrow({ where: { id: sellerId } })).payoutsHeld).toBe(
        false,
      );
      expect(await app.get(RiskService).checkPayout(sellerId, 50_000)).toBe(false);
      await outbox.drain();
      expect(mail.lastTo(`risk-store-${run}@example.com`, 'sellers.payouts-resumed')).toBeDefined();
    });
  });

  describe('payout signals', () => {
    it('holds a store whose own members buy from it', async () => {
      const member = await prisma.user.findUniqueOrThrow({
        where: { email: `risk-store-${run}@example.com` },
      });
      for (let i = 0; i < 2; i++) {
        const added = await http()
          .post('/api/v1/cart/items')
          .set(bearer(sellerToken))
          .send({ variantId: storeVariantId })
          .expect(201);
        expect(added.body.itemCount).toBeGreaterThan(0);
        const res = await http()
          .post('/api/v1/checkout')
          .set(bearer(sellerToken))
          .send({ email: member.email, shippingAddress: address })
          .expect(201);
        await pay(res.body as CheckoutResponse);
      }
      // Self-purchases (40) on top of the chargeback (30): a new review.
      expect(await app.get(RiskService).checkPayout(sellerId, 50_000)).toBe(true);
      const [review] = (await reviews(`subject=PAYOUT&status=OPEN&sellerId=${sellerId}`)).items;
      expect(review!.signals.map((s) => s.code)).toEqual(
        expect.arrayContaining(['self_purchase', 'store_chargebacks']),
      );
    });
  });
});
