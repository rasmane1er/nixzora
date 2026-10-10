import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Facet, type ProductPage, type SearchSuggestions } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { editDistance, Spelling } from '../src/modules/catalog/spelling';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Search help: suggestions, spelling and filters (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const category = `shc-${run}`;

  async function product(
    key: string,
    title: string,
    attributes: Record<string, unknown>,
    colors: string[],
    categoryId: string,
  ) {
    const created = await prisma.product.create({
      data: {
        slug: `${key}-${run}`,
        title,
        description: `${title}. A test listing.`,
        status: 'ACTIVE',
        categoryId,
        attributes: attributes as object,
        variants: {
          create: colors.map((color, i) => ({
            sku: `${key}-${i}-${run}`.toUpperCase(),
            title: color,
            options: { color },
            priceCents: 5_000 + i * 100,
            inventory: { create: { onHand: 3 } },
          })),
        },
      },
    });
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: created.id,
        type: 'catalog.product.created',
        payload: { productId: created.id },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const cat = await prisma.category.create({
      data: { slug: category, name: 'Zanzibar kettles' },
    });
    await product(
      'k1',
      `Quokka kettle ${run}`,
      { capacity_l: 1.7, auto_shutoff: true },
      ['Black', 'Sage'],
      cat.id,
    );
    await product(
      'k2',
      `Quokka travel kettle ${run}`,
      { capacity_l: 0.8, auto_shutoff: true },
      ['Black'],
      cat.id,
    );
    await product(
      'k3',
      `Quokka gooseneck kettle ${run}`,
      { capacity_l: 1, auto_shutoff: false },
      ['Copper'],
      cat.id,
    );
    await app.get(OutboxService).drain();
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const facetsFor = async (query: string) =>
    (
      (await http().get(`/api/v1/catalog/facets?category=${category}${query}`).expect(200))
        .body as {
        facets: Facet[];
      }
    ).facets;

  it('offers spec and option filters with counts, options first', async () => {
    const facets = await facetsFor('');
    expect(facets[0]?.key).toBe('color');
    expect(facets.find((f) => f.key === 'color')?.values).toEqual(
      expect.arrayContaining([{ value: 'Black', count: 2, selected: false }]),
    );
    // Numbers sort as numbers.
    expect(facets.find((f) => f.key === 'capacity_l')?.values.map((v) => v.value)).toEqual([
      '0.8',
      '1',
      '1.7',
    ]);
  });

  it('filters by any chosen value of a key and every chosen key', async () => {
    const page = async (query: string) =>
      (
        (await http().get(`/api/v1/catalog/products?category=${category}${query}`).expect(200))
          .body as ProductPage
      ).items.map((p) => p.slug);
    expect((await page('&f=color:Black')).sort()).toEqual([`k1-${run}`, `k2-${run}`]);
    expect((await page('&f=color:Black&f=color:Copper')).length).toBe(3);
    expect(await page('&f=color:Black&f=capacity_l:0.8')).toEqual([`k2-${run}`]);
    expect(await page('&f=auto_shutoff:false')).toEqual([`k3-${run}`]);
    // Counts for a chosen key ignore that key's own choice.
    const facets = await facetsFor('&f=color:Copper');
    expect(
      facets.find((f) => f.key === 'color')?.values.find((v) => v.value === 'Black')?.count,
    ).toBe(2);
    // Only values that still match something are listed.
    expect(facets.find((f) => f.key === 'capacity_l')?.values).toEqual([
      { value: '1', count: 1, selected: false },
    ]);
    await http().get('/api/v1/catalog/products?f=not-a-filter').expect(400);
  });

  it('fixes a misspelled search that found nothing', async () => {
    const res = await http().get('/api/v1/catalog/products').query({ q: 'quokkka' }).expect(200);
    const page = res.body as ProductPage;
    // The semantic index may already tolerate the typo; if not, the spelling fix finds them.
    expect(page.total).toBe(3);
    if (page.correctedQuery !== undefined) expect(page.correctedQuery).toBe('quokka');
    expect(await app.get(Spelling).correct('quokkka kettle')).toBe('quokka kettle');
  });

  it('suggests words, departments and products while typing', async () => {
    const res = await http().get('/api/v1/catalog/suggest').query({ q: 'quok' }).expect(200);
    const s = res.body as SearchSuggestions;
    expect(s.completions).toContain('quokka');
    expect(s.products.length).toBeGreaterThan(0);
    const dept = (await http().get('/api/v1/catalog/suggest').query({ q: 'zanzib' }).expect(200))
      .body as SearchSuggestions;
    expect(dept.categories.map((c) => c.slug)).toContain(category);
    const typo = (await http().get('/api/v1/catalog/suggest').query({ q: 'quokkka' }).expect(200))
      .body as SearchSuggestions;
    expect(typo.correction).toBe('quokka');
  });

  it('counts a swap of two letters as one edit', () => {
    expect(editDistance('kettel', 'kettle', 2)).toBe(1);
    expect(editDistance('kettle', 'kettle', 2)).toBe(0);
    expect(editDistance('abc', 'xyzw', 1)).toBe(2);
  });
});
