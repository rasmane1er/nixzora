import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.STORAGE_LOCAL_DIR = `/tmp/nixzora-e2e-storage-${process.pid}`;

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, ProductDetailSchema, UploadTicketSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

// A 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Catalog, inventory, media and staff tools (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inventory: InventoryService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  let customerToken: string;
  let staffToken: string;
  let staffId: string;
  let categoryId: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  /** A catalog manager who has completed two-step verification. */
  async function staffWithMfa(email: string, role: string): Promise<{ token: string; id: string }> {
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
    return { token, id: user.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    inventory = app.get(InventoryService);

    customerToken = await signUp(`shopper-${run}@example.com`);
    const staff = await staffWithMfa(`admin-${run}@example.com`, 'admin');
    staffToken = staff.token;
    staffId = staff.id;
  });

  afterAll(async () => {
    await removeTestData(app.get(PrismaService), run);
    await app.close();
  }, 30_000);

  describe('managing the catalog', () => {
    it('keeps admin catalog routes away from customers', async () => {
      await http().get('/api/v1/admin/products').set(bearer(customerToken)).expect(403);
      await http().post('/api/v1/admin/brands').send({ name: 'X' }).expect(401);
    });

    it('creates a category tree and refuses cycles', async () => {
      const parent = await http()
        .post('/api/v1/admin/categories')
        .set(bearer(staffToken))
        .send({ name: `Test Computers ${run}` })
        .expect(201);
      expect(parent.body.slug).toBe(`test-computers-${run}`);

      const child = await http()
        .post('/api/v1/admin/categories')
        .set(bearer(staffToken))
        .send({ name: `Test Laptops ${run}`, parentId: parent.body.id })
        .expect(201);
      categoryId = child.body.id;

      await http()
        .patch(`/api/v1/admin/categories/${parent.body.id}`)
        .set(bearer(staffToken))
        .send({ parentId: child.body.id })
        .expect(400);

      const tree = await http().get('/api/v1/admin/categories').set(bearer(staffToken)).expect(200);
      const node = tree.body.find((c: { id: string }) => c.id === parent.body.id);
      expect(node.children.map((c: { id: string }) => c.id)).toEqual([child.body.id]);
    });

    it('creates a product with variants and stock, then publishes it', async () => {
      const brand = await http()
        .post('/api/v1/admin/brands')
        .set(bearer(staffToken))
        .send({ name: `Zephyr ${run}` })
        .expect(201);

      const created = ProductDetailSchema.parse(
        (
          await http()
            .post('/api/v1/admin/products')
            .set(bearer(staffToken))
            .send({
              title: `Zephyr Book ${run}`,
              description: 'A quiet laptop for developers with a long battery.',
              categoryId,
              brandId: brand.body.id,
              attributes: { ram_gb: 32, battery_hours: 20 },
              variants: [
                {
                  sku: `ZB-16-${run}`,
                  title: '16GB',
                  options: { memory: '16GB' },
                  priceCents: 99900,
                  initialStock: 4,
                },
                {
                  sku: `ZB-32-${run}`,
                  title: '32GB',
                  options: { memory: '32GB' },
                  priceCents: 129900,
                  compareAtCents: 139900,
                  initialStock: 2,
                },
              ],
            })
            .expect(201)
        ).body,
      );
      expect(created.status).toBe('DRAFT');
      expect(created.priceFromCents).toBe(99900);
      expect(created.variants.map((v) => v.available)).toEqual([4, 2]);

      // Drafts are invisible to shoppers.
      await http().get(`/api/v1/catalog/products/${created.slug}`).expect(404);

      await http()
        .patch(`/api/v1/admin/products/${created.id}`)
        .set(bearer(staffToken))
        .send({ status: 'ACTIVE' })
        .expect(200);
      const page = await http().get(`/api/v1/catalog/products/${created.slug}`).expect(200);
      expect(page.body.breadcrumb.map((c: { name: string }) => c.name)).toEqual([
        `Test Computers ${run}`,
        `Test Laptops ${run}`,
      ]);

      const outbox = await prisma.outboxEvent.findMany({ where: { aggregateId: created.id } });
      expect(outbox.map((e) => e.type)).toEqual(
        expect.arrayContaining(['catalog.product.created', 'catalog.product.updated']),
      );
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'catalog.product.published', entityId: created.id },
      });
      expect(audit?.actorId).toBe(staffId);
    });

    it('rejects duplicate SKUs and invalid prices with clear messages', async () => {
      const body = {
        title: `Dupe ${run}`,
        description: 'x',
        categoryId,
        variants: [{ sku: `ZB-16-${run}`, title: 'Again', priceCents: 1000 }],
      };
      const dupe = await http()
        .post('/api/v1/admin/products')
        .set(bearer(staffToken))
        .send(body)
        .expect(409);
      expect(dupe.body.message).toMatch(/SKU/);

      const badPrice = await http()
        .post('/api/v1/admin/products')
        .set(bearer(staffToken))
        .send({
          ...body,
          variants: [{ sku: `NEW-${run}`, title: 'x', priceCents: 1000, compareAtCents: 500 }],
        })
        .expect(400);
      expect(badPrice.body.issues[0].field).toBe('variants.0.compareAtCents');
    });
  });

  describe('browsing and search', () => {
    it('finds products by words in the title, brand and specs, and by partial words', async () => {
      const byWords = await http()
        .get('/api/v1/catalog/products')
        .query({ q: 'quiet developers' })
        .expect(200);
      expect(byWords.body.items.map((p: { slug: string }) => p.slug)).toContain(
        `zephyr-book-${run}`,
      );

      const partial = await http()
        .get('/api/v1/catalog/products')
        .query({ q: `Zephyr Bo` })
        .expect(200);
      expect(partial.body.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by category subtree, price and sorts by price', async () => {
      const parentSlug = `test-computers-${run}`;
      const list = await http()
        .get('/api/v1/catalog/products')
        .query({ category: parentSlug, maxPrice: 100000, sort: 'price_asc' })
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].priceFromCents).toBe(99900);

      const none = await http()
        .get('/api/v1/catalog/products')
        .query({ category: parentSlug, minPrice: 200000 })
        .expect(200);
      expect(none.body.total).toBe(0);
    });

    it('serves the category tree with product counts that include subcategories', async () => {
      const tree = await http().get('/api/v1/catalog/categories').expect(200);
      const node = tree.body.find((c: { slug: string }) => c.slug === `test-computers-${run}`);
      expect(node.productCount).toBe(1);
    });
  });

  describe('inventory', () => {
    let variantId: string;

    beforeAll(async () => {
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { sku: `ZB-16-${run}`.toUpperCase() },
      });
      variantId = variant.id;
    });

    it('never oversells when many checkouts race for the last units', async () => {
      // 4 in stock, 12 simultaneous single-unit holds: exactly 4 may succeed.
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, () => inventory.reserve([{ variantId, quantity: 1 }], null)),
      );
      const held = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
        string[]
      >[];
      expect(held).toHaveLength(4);

      const stock = await inventory.stockFor(variantId);
      expect(stock).toMatchObject({ onHand: 4, reserved: 4, available: 0 });

      // Paying for two removes them from stock; releasing the rest makes them available again.
      await inventory.commit([held[0]!.value[0]!, held[1]!.value[0]!]);
      await inventory.release(held.slice(2).map((h) => h.value[0]!));
      expect(await inventory.stockFor(variantId)).toMatchObject({
        onHand: 2,
        reserved: 0,
        available: 2,
      });
    });

    it('releases expired holds', async () => {
      const [id] = await inventory.reserve([{ variantId, quantity: 1 }], null, -1);
      expect(id).toBeDefined();
      await inventory.sweepExpired();
      expect((await inventory.stockFor(variantId)).reserved).toBe(0);
    });

    it('adjusts stock with a reason and refuses to go negative', async () => {
      const after = await http()
        .post(`/api/v1/admin/inventory/${variantId}/adjust`)
        .set(bearer(staffToken))
        .send({ delta: 10, reason: 'RECEIVED', note: 'PO-1001' })
        .expect(201);
      expect(after.body.onHand).toBe(12);

      await http()
        .post(`/api/v1/admin/inventory/${variantId}/adjust`)
        .set(bearer(staffToken))
        .send({ delta: -100, reason: 'CORRECTION' })
        .expect(409);

      const low = await http()
        .get('/api/v1/admin/inventory')
        .query({ lowStock: 2, q: `ZB-32-${run}` })
        .set(bearer(staffToken))
        .expect(200);
      expect(low.body.map((row: { sku: string }) => row.sku)).toEqual([
        `ZB-32-${run}`.toUpperCase(),
      ]);
    });
  });

  describe('product images', () => {
    it('uploads through a signed link, checks the file type and attaches it', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { slug: `zephyr-book-${run}` },
      });
      const ticket = UploadTicketSchema.parse(
        (
          await http()
            .post('/api/v1/admin/uploads')
            .set(bearer(staffToken))
            .send({ contentType: 'image/png', sizeBytes: PNG.length })
            .expect(201)
        ).body,
      );
      const uploadPath = new URL(ticket.uploadUrl).pathname + new URL(ticket.uploadUrl).search;

      // A non-image disguised as PNG is rejected; a tampered signature is rejected.
      await http()
        .put(uploadPath)
        .set('Content-Type', 'image/png')
        .send(Buffer.from('<script>alert(1)</script>'))
        .expect(400);
      await http()
        .put(uploadPath.replace(/sig=[^&]+/, 'sig=forged'))
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(403);

      await http().put(uploadPath).set('Content-Type', 'image/png').send(PNG).expect(201);
      // Links are single-use.
      await http().put(uploadPath).set('Content-Type', 'image/png').send(PNG).expect(403);

      const detail = await http()
        .post(`/api/v1/admin/products/${product.id}/images`)
        .set(bearer(staffToken))
        .send({ storageKey: ticket.storageKey, alt: 'Zephyr Book, front view' })
        .expect(201);
      expect(detail.body.images[0].url).toBe(ticket.publicUrl);

      const served = await http().get(new URL(ticket.publicUrl).pathname).expect(200);
      expect(served.headers['content-type']).toBe('image/png');
      expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');

      await http().get('/api/v1/media/products/2026/01/..%2F..%2Fetc%2Fpasswd').expect(404);
    });

    it('takes up to 15 photos per product and lets staff choose their order', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { slug: `zephyr-book-${run}` },
      });
      const addPhoto = async (alt: string, status = 201) => {
        const ticket = UploadTicketSchema.parse(
          (
            await http()
              .post('/api/v1/admin/uploads')
              .set(bearer(staffToken))
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
          .post(`/api/v1/admin/products/${product.id}/images`)
          .set(bearer(staffToken))
          .send({ storageKey: ticket.storageKey, alt })
          .expect(status);
      };
      await addPhoto('Side view');
      const detail = ProductDetailSchema.parse((await addPhoto('Keyboard close-up')).body);
      expect(detail.images.map((i) => i.alt)).toEqual([
        'Zephyr Book, front view',
        'Side view',
        'Keyboard close-up',
      ]);

      const [front, side, keys] = detail.images.map((i) => i.id);
      const reordered = await http()
        .put(`/api/v1/admin/products/${product.id}/images/order`)
        .set(bearer(staffToken))
        .send({ imageIds: [keys, front, side] })
        .expect(200);
      expect(reordered.body.images.map((i: { alt: string }) => i.alt)).toEqual([
        'Keyboard close-up',
        'Zephyr Book, front view',
        'Side view',
      ]);
      // Every photo, once: a partial or repeated list is refused.
      await http()
        .put(`/api/v1/admin/products/${product.id}/images/order`)
        .set(bearer(staffToken))
        .send({ imageIds: [keys, front] })
        .expect(400);
      await http()
        .put(`/api/v1/admin/products/${product.id}/images/order`)
        .set(bearer(staffToken))
        .send({ imageIds: [keys, keys, side] })
        .expect(400);

      for (let n = 4; n <= 15; n++) await addPhoto(`Photo ${n}`);
      const full = await addPhoto('One too many', 409);
      expect(full.body.message).toContain('up to 15 photos');
    });
  });

  describe('staff tools', () => {
    it('lets admins find users, grant roles and suspend accounts', async () => {
      const email = `support-${run}@example.com`;
      const token = await signUp(email);
      const found = await http()
        .get('/api/v1/admin/users')
        .query({ q: email })
        .set(bearer(staffToken))
        .expect(200);
      const user = found.body.items[0];
      expect(user.roles).toEqual(['customer']);

      const granted = await http()
        .post(`/api/v1/admin/users/${user.id}/roles`)
        .set(bearer(staffToken))
        .send({ roleKey: 'support' })
        .expect(201);
      expect(granted.body.roles).toEqual(['customer', 'support']);

      await http()
        .post(`/api/v1/admin/users/${user.id}/suspend`)
        .set(bearer(staffToken))
        .expect(201);
      await http().get('/api/v1/auth/me').set(bearer(token)).expect(401);

      await http()
        .post(`/api/v1/admin/users/${staffId}/suspend`)
        .set(bearer(staffToken))
        .expect(400);
      await http()
        .delete(`/api/v1/admin/users/${staffId}/roles/admin`)
        .set(bearer(staffToken))
        .expect(400);
    });

    it('summarizes the platform for the Ops Center home screen', async () => {
      const summary = await http().get('/api/v1/admin/summary').set(bearer(staffToken)).expect(200);
      expect(summary.body.products.ACTIVE).toBeGreaterThan(0);
      expect(Array.isArray(summary.body.recentActivity)).toBe(true);
    });
  });
});
