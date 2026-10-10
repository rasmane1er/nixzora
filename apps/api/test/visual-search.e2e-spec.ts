import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { rm } from 'node:fs/promises';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type VisualSearchResult } from '@nixzora/validation';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  type ImageQuery,
  LANGUAGE_MODEL,
  type LanguageModel,
  LocalLanguageModel,
} from '../src/modules/assistant/language-model';
import { StorageService } from '../src/modules/media/storage.service';
import { fuse, VisualSearchService } from '../src/modules/visual-search/visual-search.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

/** A paid model that "sees" what the test tells it to; the local model answers the rest. */
class SeeingModel implements LanguageModel {
  readonly driver = 'anthropic' as const;
  readonly model = 'claude-haiku-4-5';
  answer: ImageQuery | null = null;
  calls = 0;
  private readonly local = new LocalLanguageModel();
  understand(...args: Parameters<LanguageModel['understand']>) {
    return this.local.understand(...args);
  }
  explain(input: Parameters<LanguageModel['explain']>[0]) {
    return this.local.explain(input);
  }
  summarizeReviews(input: Parameters<LanguageModel['summarizeReviews']>[0]) {
    return this.local.summarizeReviews(input);
  }
  writeProductCopy(facts: Parameters<LanguageModel['writeProductCopy']>[0]) {
    return this.local.writeProductCopy(facts);
  }
  describeImage() {
    this.calls += 1;
    return Promise.resolve({
      looksFor: this.answer,
      usage: { inputTokens: 1200, outputTokens: 30 },
    });
  }
}

/** A 400×400 test "product shot": a coloured shape on white. */
function shot(colour: string, shape: 'square' | 'circle' | 'stripes'): Promise<Buffer> {
  const art =
    shape === 'square'
      ? `<rect x="90" y="90" width="220" height="220" fill="${colour}"/>`
      : shape === 'circle'
        ? `<circle cx="200" cy="200" r="130" fill="${colour}"/>`
        : [0, 1, 2, 3]
            .map(
              (i) => `<rect x="40" y="${50 + i * 85}" width="320" height="40" fill="${colour}"/>`,
            )
            .join('');
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#fff"/>${art}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}

describe('Search by photo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const model = new SeeingModel();
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const keys: string[] = [];
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LANGUAGE_MODEL)
      .useValue(model)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const storage = app.get(StorageService);
    const cat = await prisma.category.create({ data: { slug: `vscat-${run}`, name: 'Photo' } });
    const make = async (key: string, image: Buffer) => {
      const storageKey = storage.newProductImageKey('image/png');
      await storage.putChecked(storageKey, image);
      keys.push(storageKey);
      const product = await prisma.product.create({
        data: {
          slug: `${key}-${run}`,
          title: `${key} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          images: { create: [{ storageKey, alt: key }] },
          variants: {
            create: [
              {
                sku: `${key}-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents: 2_000,
                inventory: { create: { onHand: 3 } },
              },
            ],
          },
        },
      });
      ids[key] = product.id;
    };
    await make('vs-red-box', await shot('#d62828', 'square'));
    await make('vs-blue-ball', await shot('#1d4ed8', 'circle'));
    await make('vs-green-mat', await shot('#15803d', 'stripes'));
    await app.get(VisualSearchService).indexPending(5000);
  }, 120_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    const storage = app.get(StorageService);
    await Promise.all(keys.map((key) => rm(storage.localPath(key), { force: true })));
    await app.close();
  });

  /** A shopper's "photo" of a test product: cropped off-centre, darker, a JPEG. */
  async function photoOf(colour: string, shape: 'square' | 'circle' | 'stripes') {
    const jpeg = await sharp(await shot(colour, shape))
      .extract({ left: 30, top: 50, width: 340, height: 330 })
      .modulate({ brightness: 0.85 })
      .resize(300)
      .jpeg({ quality: 60 })
      .toBuffer();
    return jpeg.toString('base64');
  }

  it('signs every product image, then finds the product in a photo', async () => {
    const signed = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM product_images
      WHERE product_id = ANY(${Object.values(ids)}::uuid[]) AND visual IS NOT NULL`;
    expect(signed[0]!.count).toBe(3);

    model.answer = null;
    const res = await http()
      .post('/api/v1/catalog/visual-search')
      .send({ image: await photoOf('#d62828', 'square') })
      .expect(200);
    const result = res.body as VisualSearchResult;
    const order = result.products.map((p) => p.id);
    expect(order.indexOf(ids['vs-red-box']!)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(ids['vs-red-box']!)).toBeLessThan(3);
    const rank = (key: string) => {
      const at = order.indexOf(ids[key]!);
      return at < 0 ? Infinity : at;
    };
    expect(rank('vs-red-box')).toBeLessThan(rank('vs-blue-ball'));
    expect(rank('vs-red-box')).toBeLessThan(rank('vs-green-mat'));
    expect(result.query).toBeNull();
    // Cards are full product cards (price, image, link).
    const card = result.products.find((p) => p.id === ids['vs-red-box'])!;
    expect(card.slug).toBe(`vs-red-box-${run}`);
    expect(card.image?.url).toMatch(/\/media\/products\//);

    // The result can be shown again on a page, without the photo.
    const again = await http().get(`/api/v1/catalog/visual-search/${result.id}`).expect(200);
    expect((again.body as VisualSearchResult).products.map((p) => p.id)).toEqual(order);
  });

  it('takes the photo as raw bytes too (the app sends the file as it is)', async () => {
    const big = await sharp(await shot('#15803d', 'stripes'))
      .resize(2400)
      .jpeg({ quality: 95 })
      .toBuffer();
    const res = await http()
      .post('/api/v1/catalog/visual-search/upload')
      .set('Content-Type', 'image/jpeg')
      .send(big)
      .expect(200);
    const order = (res.body as VisualSearchResult).products.map((p) => p.id);
    const green = order.indexOf(ids['vs-green-mat']!);
    const red = order.indexOf(ids['vs-red-box']!);
    expect(green).toBeGreaterThanOrEqual(0);
    // The red box is further down, or not among the matches at all.
    expect(red === -1 || green < red).toBe(true);
    await http()
      .post('/api/v1/catalog/visual-search/upload')
      .set('Content-Type', 'application/json')
      .send({ image: 'x' })
      .expect(400);
  });

  it('blends in what a paid model sees, and logs the call', async () => {
    model.answer = { query: `vs-green-mat ${run}`, category: `vscat-${run}` };
    const before = model.calls;
    const res = await http()
      .post('/api/v1/catalog/visual-search')
      .send({ image: await photoOf('#1d4ed8', 'circle') })
      .expect(200);
    const result = res.body as VisualSearchResult;
    expect(model.calls).toBe(before + 1);
    expect(result.query).toBe(`vs-green-mat ${run}`);
    expect(result.category).toEqual({ slug: `vscat-${run}`, name: 'Photo' });
    const order = result.products.map((p) => p.id);
    // Text and picture agree on nothing here, so both leaders are near the top.
    expect(order.slice(0, 3)).toEqual(
      expect.arrayContaining([ids['vs-green-mat'], ids['vs-blue-ball']]),
    );
    const logged = await prisma.aiRequest.findFirst({
      where: { feature: 'photo_search' },
      orderBy: { createdAt: 'desc' },
    });
    expect(logged?.model).toBe('claude-haiku-4-5');
    expect(logged?.inputTokens).toBe(1200);
    model.answer = null;
  });

  it('refuses things that are not pictures, and expired results', async () => {
    await http()
      .post('/api/v1/catalog/visual-search')
      .send({ image: Buffer.from('not an image at all '.repeat(20)).toString('base64') })
      .expect(400);
    await http()
      .post('/api/v1/catalog/visual-search')
      .send({ image: 'data:image/png;base64,xx' })
      .expect(400);
    const tiny = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#ff0000' },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    await http()
      .post('/api/v1/catalog/visual-search')
      .send({ image: tiny.toString('base64') })
      .expect(400);
    await http()
      .get('/api/v1/catalog/visual-search/7b0f6f7e-5b8a-4c39-9f0a-3f2f4b4f7f11')
      .expect(404);
  });

  it('fuses ranked lists so items both agree on come first', () => {
    expect(
      fuse([
        ['a', 'b', 'c'],
        ['c', 'a', 'd'],
      ]),
    ).toEqual(['a', 'c', 'b', 'd']);
  });
});
