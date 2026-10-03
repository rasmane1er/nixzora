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
  type ListingImportResult,
  type OrderView,
  type PayoutView,
  type SellerAnalytics,
  type SellerBalance,
  type SellerOrderView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { MailService } from '../src/modules/notifications/mail.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PayoutsService } from '../src/modules/sellers/payouts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
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

  describe('payouts', () => {
    const payouts = async () =>
      (await http().get('/api/v1/seller/payouts').set(bearer(sellerToken)).expect(200)).body
        .items as PayoutView[];

    it('pays out only what is past its hold, and never twice', async () => {
      // Nothing has cleared the 14-day hold yet: available is still -$88 from the refund.
      await http()
        .post(`/api/v1/admin/sellers/${sellerId}/payouts`)
        .set(bearer(staffToken))
        .expect(409);
      // Fast-forward: the two sales clear their hold.
      await prisma.sellerLedgerEntry.updateMany({
        where: { sellerId, type: 'SALE' },
        data: { availableAt: new Date(Date.now() - 1000) },
      });
      expect((await balance()).availableCents).toBe(17600 + 8800 - 8800);

      await http()
        .post(`/api/v1/admin/sellers/${sellerId}/payouts`)
        .set(bearer(sellerToken))
        .expect(403);
      const payout = (
        await http()
          .post(`/api/v1/admin/sellers/${sellerId}/payouts`)
          .set(bearer(staffToken))
          .expect(201)
      ).body as PayoutView;
      expect(payout).toMatchObject({ status: 'PAID', amountCents: 17600, automatic: false });
      expect(await balance()).toMatchObject({ availableCents: 0, lifetimeNetCents: 17600 });
      expect((await payouts()).map((p) => p.id)).toEqual([payout.id]);
      expect(mail.lastTo(sellerEmail, 'sellers.payout-sent')?.text).toContain('$176.00');

      // The balance is empty now; a second payout is refused.
      await http()
        .post(`/api/v1/admin/sellers/${sellerId}/payouts`)
        .set(bearer(staffToken))
        .expect(409);
      const row = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
      expect(row.providerTransferId).toMatch(/^fake_tr_/);
    });

    it('puts the money back when the transfer fails', async () => {
      await prisma.sellerLedgerEntry.create({
        data: {
          sellerId,
          type: 'ADJUSTMENT',
          amountCents: 2500,
          availableAt: new Date(Date.now() - 1000),
          description: 'Test credit',
          idempotencyKey: `test-credit:${run}`,
        },
      });
      await prisma.seller.update({
        where: { id: sellerId },
        data: { payoutAccountId: `broken_${run}` },
      });
      const failed = (
        await http()
          .post(`/api/v1/admin/sellers/${sellerId}/payouts`)
          .set(bearer(staffToken))
          .expect(201)
      ).body as PayoutView;
      expect(failed).toMatchObject({ status: 'FAILED', amountCents: 2500 });
      expect(failed.failureReason).toBeTruthy();
      expect((await balance()).availableCents).toBe(2500);

      // Fixed account: the daily run sends it (the store's last successful payout was today, so
      // first make it look like yesterday's).
      await prisma.seller.update({
        where: { id: sellerId },
        data: { payoutAccountId: `fake_acct_${run}` },
      });
      await prisma.payout.updateMany({
        where: { sellerId },
        data: { createdAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      await app.get(RedisService).client.del('payouts:run');
      const result = await app.get(PayoutsService).runDue();
      expect(result.paid).toBeGreaterThanOrEqual(1);
      expect((await payouts())[0]).toMatchObject({
        status: 'PAID',
        amountCents: 2500,
        automatic: true,
      });
      expect((await balance()).availableCents).toBe(0);
    });
  });

  describe('bulk listings (CSV)', () => {
    const importCsv = (csv: string, dryRun: boolean) =>
      http()
        .post('/api/v1/seller/products/import')
        .set(bearer(sellerToken))
        .send({ csv, dryRun })
        .expect(200);

    it('serves a template, checks a file without saving, then creates drafts', async () => {
      const template = await http()
        .get('/api/v1/seller/products/import/template')
        .set(bearer(sellerToken))
        .expect(200);
      expect(template.headers['content-type']).toContain('text/csv');
      expect(template.text.split('\r\n')[0]).toBe(
        'product,title,category,description,specs,sku,option,price,compare_at_price,stock,barcode',
      );

      const header = template.text.split('\r\n')[0];
      const bad = [header, `,Preamp,no-such-category,Desc,,PRE-${run},,99,,1,`].join('\n');
      const checked = (await importCsv(bad, false)).body as ListingImportResult;
      // Errors force a dry run: nothing is saved.
      expect(checked).toMatchObject({ dryRun: true, newListings: 0, createdIds: [] });
      expect(checked.errors).toEqual([
        { row: 2, column: 'category', message: 'Unknown category "no-such-category".' },
      ]);

      const good = [
        header,
        `pre,Phono preamp ${run},amps-${run},A quiet MM phono stage.,gain_db: 40,PRE-BLK-${run},Black,149,,5,`,
        `pre,,,,,PRE-SLV-${run},Silver,159,,4,`,
        // An option the store already sells: its price and stock change.
        `,,,,,AMP-${run},,95.00,,30,`,
      ].join('\n');
      const preview = (await importCsv(good, true)).body as ListingImportResult;
      expect(preview).toMatchObject({
        dryRun: true,
        rows: 3,
        newListings: 1,
        newOptions: 2,
        updatedOptions: 1,
        errors: [],
      });
      expect(await prisma.product.count({ where: { title: `Phono preamp ${run}` } })).toBe(0);

      const done = (await importCsv(good, false)).body as ListingImportResult;
      expect(done).toMatchObject({ dryRun: false, newListings: 1, errors: [] });
      expect(done.createdIds).toHaveLength(1);
      const draft = await prisma.product.findUniqueOrThrow({
        where: { id: done.createdIds[0] },
        include: { variants: { include: { inventory: true }, orderBy: { priceCents: 'asc' } } },
      });
      expect(draft).toMatchObject({ status: 'DRAFT', sellerId, attributes: { gain_db: 40 } });
      expect(draft.variants.map((v) => [v.sku, v.priceCents, v.inventory?.onHand])).toEqual([
        [`PRE-BLK-${run}`.toUpperCase(), 14900, 5],
        [`PRE-SLV-${run}`.toUpperCase(), 15900, 4],
      ]);
      const amp = await prisma.productVariant.findUniqueOrThrow({
        where: { id: sellerVariant },
        include: { inventory: true },
      });
      expect(amp.priceCents).toBe(9500);
      expect(amp.inventory?.onHand).toBe(30);

      // The export round-trips: uploading it unchanged changes nothing.
      const exported = await http()
        .get('/api/v1/seller/products/export')
        .set(bearer(sellerToken))
        .expect(200);
      expect(exported.text).toContain(`PRE-SLV-${run}`.toUpperCase());
      const again = (await importCsv(exported.text, true)).body as ListingImportResult;
      expect(again).toMatchObject({ newListings: 0, updatedOptions: 0, errors: [] });
    });

    it("refuses another store's SKUs", async () => {
      const csv = `sku,price,title,category,description\nCBL-${run},10,Cable,amps-${run},Desc`;
      const result = (await importCsv(csv, true)).body as ListingImportResult;
      expect(result.errors[0]).toMatchObject({ row: 2, column: 'sku' });
    });
  });

  describe('AI listing assistant', () => {
    it("drafts a description from the listing's specs, for its own store only", async () => {
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: sellerVariant },
      });
      const draft = await http()
        .post(`/api/v1/seller/products/${variant.productId}/copy-suggestion`)
        .set(bearer(sellerToken))
        .expect(200);
      // CI uses the local driver: a draft from the specs, never saved.
      expect(draft.body).toMatchObject({ aiWritten: false, model: 'local' });
      expect(draft.body.description.length).toBeGreaterThan(20);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: variant.productId } })).description,
      ).toBe('Test product.');
      const outsider = await signUp(`mkt-outsider-${run}@example.com`);
      await http()
        .post(`/api/v1/seller/products/${variant.productId}/copy-suggestion`)
        .set(bearer(outsider))
        .expect(403);
    });
  });

  describe('seller analytics', () => {
    it('sums the store’s sales, earnings and best sellers, leaving out cancelled orders', async () => {
      // One shopper views the amp's page.
      const amp = await prisma.productVariant.findUniqueOrThrow({ where: { id: sellerVariant } });
      await http()
        .post('/api/v1/events/views')
        .send({ productId: amp.productId, visitorId: `visitor-${run}-0000000000` });
      const stats = (
        await http().get('/api/v1/seller/analytics?days=30').set(bearer(sellerToken)).expect(200)
      ).body as SellerAnalytics;
      // Paid orders: 2 amps ($200, later $100 refunded) and 1 amp ($100); one cancelled order.
      expect(stats.totals).toMatchObject({
        salesCents: 30000,
        orders: 2,
        units: 3,
        netCents: 17600 + 8800,
        refundedCents: 10000,
        views: 1,
        conversionPct: 200, // 2 orders per 1 view: small numbers make odd ratios
      });
      expect(stats.previous.orders).toBe(0);
      expect(stats.daily).toHaveLength(30);
      expect(stats.daily.at(-1)).toMatchObject({ salesCents: 30000, orders: 2 });
      expect(stats.topProducts[0]).toMatchObject({
        title: 'Tube amp',
        units: 3,
        salesCents: 30000,
      });
      await http().get('/api/v1/seller/analytics?days=12').set(bearer(sellerToken)).expect(400);
    });
  });
});
