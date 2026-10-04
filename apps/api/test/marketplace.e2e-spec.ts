import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYOUTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AdminSellerViewSchema,
  AuthTokensSchema,
  ProductDetailSchema,
  PublicSellerSchema,
  SellerMeResponseSchema,
  SellerViewSchema,
  UploadTicketSchema,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Marketplace sellers and listing review (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let categoryId: string;
  let staffToken: string;
  let sellerToken: string;
  let otherToken: string;
  let sellerId: string;
  let productId: string;
  let variantId: string;
  const handle = `brightline-${run}`;
  /** A complete seller application (p8-13); tests override what they check. */
  const application = (overrides: Record<string, unknown> = {}) => ({
    businessType: 'LLC',
    legalName: 'Brightline Audio LLC',
    displayName: 'Brightline Audio',
    category: 'audio',
    whatYouSell: 'Desk speakers and amplifiers',
    address: {
      line1: '1 Harbor St',
      city: 'Baltimore',
      region: 'MD',
      postalCode: '21202',
      country: 'US',
    },
    owner: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1990-05-02',
      phone: '+1 410 555 0100',
      residenceCountry: 'US',
    },
    description: 'Desk speakers, tuned in Baltimore.',
    handlingDays: 2,
    carriers: ['USPS', 'UPS'],
    shipRegions: ['US_CONTIGUOUS'],
    acknowledgeFees: true,
    acceptAgreement: true,
    acceptReturnPolicy: true,
    confirmAccurate: true,
    ...overrides,
  });

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
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

  async function attachPhoto(token: string, id: string) {
    const ticket = UploadTicketSchema.parse(
      (
        await http()
          .post('/api/v1/seller/uploads')
          .set(bearer(token))
          .send({ contentType: 'image/png', sizeBytes: PNG.length })
          .expect(201)
      ).body,
    );
    const url = new URL(ticket.uploadUrl);
    await http()
      .put(url.pathname + url.search)
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(201);
    return http()
      .post(`/api/v1/seller/products/${id}/images`)
      .set(bearer(token))
      .send({ storageKey: ticket.storageKey, alt: 'Speaker, front' })
      .expect(201);
  }

  const publicProduct = (slug: string) => http().get(`/api/v1/catalog/products/${slug}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    categoryId = (
      await prisma.category.create({ data: { name: `Speakers ${run}`, slug: `speakers-${run}` } })
    ).id;
    staffToken = await staff(`mkt-admin-${run}@example.com`, 'admin');
    sellerToken = await signUp(`mkt-seller-${run}@example.com`);
    otherToken = await signUp(`mkt-other-${run}@example.com`);
  }, 30_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  }, 30_000);

  it('saves an unfinished application to continue later', async () => {
    await http()
      .get('/api/v1/seller/application')
      .set(bearer(sellerToken))
      .expect(200, { draft: null });
    const saved = await http()
      .put('/api/v1/seller/application')
      .set(bearer(sellerToken))
      .send({ step: 2, completed: ['business'], data: { business: { displayName: 'Brightline' } } })
      .expect(200);
    expect(saved.body).toMatchObject({ step: 2, completed: ['business'] });
    const back = await http()
      .get('/api/v1/seller/application')
      .set(bearer(sellerToken))
      .expect(200);
    expect(back.body.draft.data).toEqual({ business: { displayName: 'Brightline' } });
    await http()
      .put('/api/v1/seller/application')
      .set(bearer(sellerToken))
      .send({ step: 9, completed: [], data: {} })
      .expect(400);
    // Other customers never see it.
    await http()
      .get('/api/v1/seller/application')
      .set(bearer(otherToken))
      .expect(200, { draft: null });
  });

  it('lets a customer apply to sell, once', async () => {
    const before = SellerMeResponseSchema.parse(
      (await http().get('/api/v1/seller/me').set(bearer(sellerToken)).expect(200)).body,
    );
    expect(before.seller).toBeNull();

    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(sellerToken))
      .send(application({ handle, acceptAgreement: false }))
      .expect(400); // agreement not accepted
    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(sellerToken))
      .send(application({ handle, owner: { ...application().owner, dateOfBirth: '2015-01-01' } }))
      .expect(400); // owner under 18
    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(sellerToken))
      .send(application({ handle: 'nixzora-deals' }))
      .expect(400); // reserved address

    const seller = SellerViewSchema.parse(
      (
        await http()
          .post('/api/v1/seller/apply')
          .set(bearer(sellerToken))
          .send(application({ handle }))
          .expect(201)
      ).body,
    );
    sellerId = seller.id;
    expect(seller).toMatchObject({
      status: 'PENDING',
      contactEmail: `mkt-seller-${run}@example.com`,
      commissionBps: 1200,
      payouts: { accountConnected: false, payoutsEnabled: false },
    });
    expect(seller).toMatchObject({
      businessType: 'LLC',
      category: 'audio',
      address: { city: 'Baltimore', region: 'MD' },
      shipping: { handlingDays: 2, carriers: ['USPS', 'UPS'] },
    });
    // The owner's personal details stay out of the store's own view.
    expect(JSON.stringify(seller)).not.toContain('1990-05-02');
    expect(JSON.stringify(seller)).not.toContain('Lovelace');
    const stored = await prisma.sellerOwner.findUniqueOrThrow({ where: { sellerId: seller.id } });
    expect(stored.dateOfBirthEnc).not.toContain('1990');
    // Submitting removes the draft.
    expect(
      await prisma.sellerApplicationDraft.count({
        where: { user: { email: `mkt-seller-${run}@example.com` } },
      }),
    ).toBe(0);

    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(sellerToken))
      .send(application({ displayName: 'Again' }))
      .expect(409);
    // Another customer cannot take the same store address.
    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(otherToken))
      .send(application({ displayName: 'Copy', handle }))
      .expect(409);
    // The pending store is not public yet.
    await http().get(`/api/v1/catalog/sellers/${handle}`).expect(404);
  });

  it('keeps pending stores to drafts and needs payout verification before approval', async () => {
    const draft = ProductDetailSchema.parse(
      (
        await http()
          .post('/api/v1/seller/products')
          .set(bearer(sellerToken))
          .send({
            title: `Lumen Bookshelf Speakers ${run}`,
            description: 'Passive bookshelf speakers with a 5-inch woofer.',
            categoryId,
            attributes: { watts: 60 },
            variants: [
              {
                sku: `LBS-${run}`,
                title: 'Walnut pair',
                priceCents: 24900,
                initialStock: 4,
              },
            ],
          })
          .expect(201)
      ).body,
    );
    productId = draft.id;
    variantId = draft.variants[0]!.id;
    expect(draft).toMatchObject({ status: 'DRAFT', seller: { handle } });

    // Sellers can't publish themselves, and only see their own listings.
    await http()
      .patch(`/api/v1/seller/products/${productId}`)
      .set(bearer(sellerToken))
      .send({ status: 'ACTIVE' })
      .expect(200)
      .then((res) => expect(res.body.status).toBe('DRAFT'));
    await http().get(`/api/v1/seller/products/${productId}`).set(bearer(otherToken)).expect(403); // not a seller at all
    await http()
      .post(`/api/v1/seller/products/${productId}/submit`)
      .set(bearer(sellerToken))
      .expect(403);

    // Approval waits for payout verification.
    await http()
      .post(`/api/v1/admin/sellers/${sellerId}/status`)
      .set(bearer(staffToken))
      .send({ status: 'ACTIVE' })
      .expect(409);

    const link = await http()
      .post('/api/v1/seller/payouts/onboarding')
      .set(bearer(sellerToken))
      .expect(201);
    expect(link.body.url).toMatch(/\/sell\/payouts\/return$/);
    const verified = SellerViewSchema.parse(
      (await http().post('/api/v1/seller/payouts/refresh').set(bearer(sellerToken)).expect(200))
        .body,
    );
    expect(verified.payouts).toMatchObject({
      provider: 'FAKE',
      accountConnected: true,
      detailsSubmitted: true,
      payoutsEnabled: true,
    });
    // The store is told by email that payouts are on (one event, not one per refresh).
    await http().post('/api/v1/seller/payouts/refresh').set(bearer(sellerToken)).expect(200);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: sellerId, type: 'seller.payouts_verified' },
      }),
    ).toBe(1);

    // Stripe Connect's account webhook exists only when Stripe pays the sellers.
    await http()
      .post('/api/v1/payments/webhooks/stripe-connect')
      .set('stripe-signature', 't=1,v1=forged')
      .send({ type: 'account.updated' })
      .expect(403);
  });

  it('lets staff approve the store and set its terms', async () => {
    await http()
      .post(`/api/v1/admin/sellers/${sellerId}/status`)
      .set(bearer(sellerToken))
      .send({ status: 'ACTIVE' })
      .expect(403);
    const approved = AdminSellerViewSchema.parse(
      (
        await http()
          .post(`/api/v1/admin/sellers/${sellerId}/status`)
          .set(bearer(staffToken))
          .send({ status: 'ACTIVE' })
          .expect(200)
      ).body,
    );
    expect(approved).toMatchObject({
      status: 'ACTIVE',
      owner: { email: `mkt-seller-${run}@example.com` },
      listings: { draft: 1 },
    });
    expect(approved.approvedAt).not.toBeNull();

    await http()
      .patch(`/api/v1/admin/sellers/${sellerId}`)
      .set(bearer(staffToken))
      .send({ commissionBps: 9000 })
      .expect(400);
    await http()
      .patch(`/api/v1/admin/sellers/${sellerId}`)
      .set(bearer(staffToken))
      .send({ commissionBps: 1000, payoutHoldDays: 21 })
      .expect(200)
      .then((res) => expect(res.body).toMatchObject({ commissionBps: 1000, payoutHoldDays: 21 }));

    const list = await http()
      .get(`/api/v1/admin/sellers?q=${handle}`)
      .set(bearer(staffToken))
      .expect(200);
    expect(list.body.items.map((s: { id: string }) => s.id)).toEqual([sellerId]);
    const store = PublicSellerSchema.parse(
      (await http().get(`/api/v1/catalog/sellers/${handle}`).expect(200)).body,
    );
    expect(store).toMatchObject({ category: 'audio', salesCount: 0, handlingDays: 2 });
    // Staff see the private verification details; the public page never does.
    const reviewed = (
      await http().get(`/api/v1/admin/sellers/${sellerId}`).set(bearer(staffToken)).expect(200)
    ).body;
    expect(reviewed.verification).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1990-05-02',
    });
    expect(JSON.stringify(store)).not.toContain('Lovelace');
  });

  it('reviews listings before they go live', async () => {
    // A listing needs a photo before review.
    await http()
      .post(`/api/v1/seller/products/${productId}/submit`)
      .set(bearer(sellerToken))
      .expect(400);
    await attachPhoto(sellerToken, productId);
    await http()
      .post(`/api/v1/seller/products/${productId}/submit`)
      .set(bearer(sellerToken))
      .expect(200);

    const queue = await http()
      .get('/api/v1/admin/listings/review')
      .set(bearer(staffToken))
      .expect(200);
    expect(queue.body.items.map((row: { id: string }) => row.id)).toContain(productId);

    // Sent back with a note; the seller sees it, the public never does.
    await http()
      .post(`/api/v1/admin/listings/${productId}/review`)
      .set(bearer(staffToken))
      .send({ decision: 'REJECT' })
      .expect(400);
    await http()
      .post(`/api/v1/admin/listings/${productId}/review`)
      .set(bearer(staffToken))
      .send({ decision: 'REJECT', note: 'Add the driver size to the specs.' })
      .expect(200);
    const sentBack = ProductDetailSchema.parse(
      (
        await http()
          .get(`/api/v1/seller/products/${productId}`)
          .set(bearer(sellerToken))
          .expect(200)
      ).body,
    );
    expect(sentBack).toMatchObject({
      status: 'DRAFT',
      reviewNote: 'Add the driver size to the specs.',
    });

    await http()
      .patch(`/api/v1/seller/products/${productId}`)
      .set(bearer(sellerToken))
      .send({ attributes: { watts: 60, woofer_in: 5 } })
      .expect(200);
    await http()
      .post(`/api/v1/seller/products/${productId}/submit`)
      .set(bearer(sellerToken))
      .expect(200);
    await http()
      .post(`/api/v1/admin/listings/${productId}/review`)
      .set(bearer(staffToken))
      .send({ decision: 'APPROVE' })
      .expect(200);

    const live = ProductDetailSchema.parse(
      (await publicProduct(`lumen-bookshelf-speakers-${run}`).expect(200)).body,
    );
    expect(live).toMatchObject({
      seller: { handle, displayName: 'Brightline Audio' },
      reviewNote: null,
    });
    const storeProducts = await http().get(`/api/v1/catalog/products?seller=${handle}`).expect(200);
    expect(storeProducts.body.total).toBe(1);
  });

  it('keeps price and stock edits live but sends content edits back to review', async () => {
    await http()
      .patch(`/api/v1/seller/variants/${variantId}`)
      .set(bearer(sellerToken))
      .send({ priceCents: 22900 })
      .expect(200);
    await http()
      .post(`/api/v1/seller/variants/${variantId}/stock`)
      .set(bearer(sellerToken))
      .send({ delta: 6, reason: 'RECEIVED' })
      .expect(200);
    const live = (await publicProduct(`lumen-bookshelf-speakers-${run}`).expect(200)).body;
    expect(live.variants[0]).toMatchObject({ priceCents: 22900, available: 10 });

    // Someone else's seller account cannot touch this listing.
    await http()
      .post('/api/v1/seller/apply')
      .set(bearer(otherToken))
      .send(application({ displayName: 'Other', handle: `other-${run}` }))
      .expect(201);
    await http()
      .patch(`/api/v1/seller/variants/${variantId}`)
      .set(bearer(otherToken))
      .send({ priceCents: 100 })
      .expect(404);
    await http().get(`/api/v1/seller/products/${productId}`).set(bearer(otherToken)).expect(404);

    // Saving the form unchanged (as the portal does) keeps the listing live.
    const current = (
      await http().get(`/api/v1/seller/products/${productId}`).set(bearer(sellerToken))
    ).body;
    await http()
      .patch(`/api/v1/seller/products/${productId}`)
      .set(bearer(sellerToken))
      .send({
        title: current.title,
        description: current.description,
        categoryId,
        attributes: { woofer_in: 5, watts: 60 },
      })
      .expect(200)
      .then((res) => expect(res.body.status).toBe('ACTIVE'));

    const edited = await http()
      .patch(`/api/v1/seller/products/${productId}`)
      .set(bearer(sellerToken))
      .send({ title: `Lumen Bookshelf Speakers (2027) ${run}` })
      .expect(200);
    expect(edited.body.status).toBe('PENDING_REVIEW');
    await publicProduct(`lumen-bookshelf-speakers-${run}`).expect(404);
    await http()
      .post(`/api/v1/admin/listings/${productId}/review`)
      .set(bearer(staffToken))
      .send({ decision: 'APPROVE' })
      .expect(200);
  });

  it('takes a suspended store off the shelves', async () => {
    await http()
      .post(`/api/v1/admin/sellers/${sellerId}/status`)
      .set(bearer(staffToken))
      .send({ status: 'SUSPENDED' })
      .expect(400); // a reason is required
    const suspended = AdminSellerViewSchema.parse(
      (
        await http()
          .post(`/api/v1/admin/sellers/${sellerId}/status`)
          .set(bearer(staffToken))
          .send({ status: 'SUSPENDED', reason: 'Counterfeit complaint under review.' })
          .expect(200)
      ).body,
    );
    expect(suspended).toMatchObject({
      status: 'SUSPENDED',
      statusReason: 'Counterfeit complaint under review.',
      listings: { active: 0, draft: 1 },
    });
    await publicProduct(`lumen-bookshelf-speakers-${run}`).expect(404);
    await http().get(`/api/v1/catalog/sellers/${handle}`).expect(404);
    await http()
      .post('/api/v1/seller/products')
      .set(bearer(sellerToken))
      .send({
        title: 'Anything',
        description: 'x',
        categoryId,
        variants: [{ sku: `ANY-${run}`, title: 'One', priceCents: 100 }],
      })
      .expect(403);

    const actions = await prisma.auditLog.findMany({
      where: { entityId: sellerId },
      select: { action: true },
      orderBy: { id: 'asc' },
    });
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'seller.applied',
        'seller.payouts.account_created',
        'seller.approved',
        'seller.terms.updated',
        'seller.suspended',
      ]),
    );
  });

  it('can reject a pending application but not an approved store', async () => {
    const other = await prisma.seller.findUniqueOrThrow({ where: { handle: `other-${run}` } });
    await http()
      .post(`/api/v1/admin/sellers/${sellerId}/status`)
      .set(bearer(staffToken))
      .send({ status: 'REJECTED', reason: 'Not eligible.' })
      .expect(409);
    await http()
      .post(`/api/v1/admin/sellers/${other.id}/status`)
      .set(bearer(staffToken))
      .send({ status: 'REJECTED', reason: 'Business could not be verified.' })
      .expect(200);
    // A rejected store cannot upload or list anything.
    await http()
      .post('/api/v1/seller/uploads')
      .set(bearer(otherToken))
      .send({ contentType: 'image/png', sizeBytes: PNG.length })
      .expect(403);
  });
});
