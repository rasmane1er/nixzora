import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReviewInsightsSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  LANGUAGE_MODEL,
  type LanguageModel,
  LocalLanguageModel,
} from '../src/modules/assistant/language-model';
import { REVIEWS_CHANGED } from '../src/modules/insights/events';
import { ProductCopyService } from '../src/modules/insights/product-copy.service';
import { ReviewInsightsService } from '../src/modules/insights/review-insights.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

/** Stands in for a paid model; `reply` is what it writes for the review summary. */
class FakeModel implements LanguageModel {
  readonly driver = 'anthropic' as const;
  readonly model = 'claude-haiku-4-5';
  reply = '';
  /** What it writes in other languages; `reply` when absent. */
  translations: Partial<Record<string, string>> = {};
  private readonly local = new LocalLanguageModel();
  understand(...args: Parameters<LanguageModel['understand']>) {
    return this.local.understand(...args);
  }
  explain(input: Parameters<LanguageModel['explain']>[0]) {
    return this.local.explain(input);
  }
  summarizeReviews(input: Parameters<LanguageModel['summarizeReviews']>[0]) {
    const text = (input.locale && this.translations[input.locale]) ?? this.reply;
    return Promise.resolve({ text, usage: { inputTokens: 900, outputTokens: 60 } });
  }
  writeProductCopy() {
    return Promise.resolve({ text: this.reply, usage: { inputTokens: 500, outputTokens: 80 } });
  }
}

describe('Review insights (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const fake = new FakeModel();
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let productId: string;
  const slug = `insight-headphones-${run}`;

  async function addReview(n: number, rating: number, body: string) {
    const user = await prisma.user.create({
      data: { email: `insight-${n}-${run}@example.com`, firstName: `Reviewer ${n}` },
    });
    await prisma.review.create({
      data: { productId, userId: user.id, rating, title: 'Review', body, status: 'APPROVED' },
    });
  }

  async function reviewsChanged() {
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: productId,
        type: REVIEWS_CHANGED,
        payload: { productId },
      },
    });
    await app.get(OutboxService).drain();
  }

  const insights = async () =>
    (await http().get(`/api/v1/catalog/products/${slug}/reviews/insights`).expect(200)).body as {
      insights: unknown;
    };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LANGUAGE_MODEL)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const category = await prisma.category.create({
      data: { slug: `insight-cat-${run}`, name: 'Headphones' },
    });
    productId = (
      await prisma.product.create({
        data: {
          slug,
          title: `Insight headphones ${run}`,
          description: 'Test',
          status: 'ACTIVE',
          categoryId: category.id,
        },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
    await prisma.aiRequest.deleteMany({
      where: { feature: 'review_insights', createdAt: { gt: new Date(Date.now() - 600_000) } },
    });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('shows nothing until there are three approved reviews', async () => {
    await addReview(1, 5, 'The sound is amazing and very comfortable.');
    await addReview(2, 4, 'Comfortable for hours, sound is great.');
    await reviewsChanged();
    expect((await insights()).insights).toBeNull();
  });

  it('builds the summary from the reviews and rejects a model text with invented numbers', async () => {
    fake.reply = '9 out of 10 owners love these headphones.';
    await addReview(3, 2, 'Sound is great but the Bluetooth connection keeps dropping.');
    await reviewsChanged();

    const result = ReviewInsightsSchema.parse((await insights()).insights);
    expect(result).toMatchObject({ reviewCount: 3, positivePercent: 67, aiWritten: false });
    expect(result.summary).toMatch(/^67% of 3 reviewers rate it 4 or 5 stars\./);
    expect(result.pros.map((p) => p.label)).toEqual(expect.arrayContaining(['Sound', 'Comfort']));
    expect(result.cons).toEqual([{ label: 'Connectivity', mentions: 1 }]);

    const logged = await prisma.aiRequest.findFirst({
      where: { feature: 'review_insights' },
      orderBy: { createdAt: 'desc' },
    });
    expect(logged).toMatchObject({ grounded: false, model: 'claude-haiku-4-5' });
  });

  it('keeps a grounded model summary and labels it as AI-written', async () => {
    fake.reply = 'Reviewers love the sound and comfort; 1 mentions Bluetooth dropouts.';
    await addReview(4, 5, 'Fantastic sound.');
    await reviewsChanged();
    const result = ReviewInsightsSchema.parse((await insights()).insights);
    expect(result).toMatchObject({ reviewCount: 4, aiWritten: true });
    expect(result.summary).toBe(fake.reply);
  });

  it('drafts product copy, and sets aside a draft with invented numbers', async () => {
    const copy = app.get(ProductCopyService);
    fake.reply = 'Up to 60 hours of battery and the best noise cancelling anywhere.';
    const rejected = await copy.suggest(productId);
    expect(rejected).toMatchObject({ aiWritten: false, model: 'local' });
    expect(rejected.notes.join(' ')).toMatch(/numbers not in the specs: 60/);

    fake.reply =
      'Over-ear headphones for long listening sessions, with a comfortable fit and a clean, balanced sound.';
    expect(await copy.suggest(productId)).toEqual({
      description: fake.reply,
      aiWritten: true,
      model: 'claude-haiku-4-5',
      notes: [],
    });
  });

  it('serves French and Spanish readers, from stored model text or the translated template', async () => {
    fake.reply = 'Reviewers love the sound and comfort.';
    fake.translations = {
      fr: 'Les clients adorent le son et le confort ; 1 avis signale des coupures Bluetooth.',
      es: '9 de cada 10 clientes aman el sonido.', // invented number: rejected
    };
    await addReview(5, 5, 'Comfortable and the sound is fantastic.');
    await reviewsChanged();
    fake.translations = {};

    const english = ReviewInsightsSchema.parse((await insights()).insights);
    expect(english).toMatchObject({ summary: fake.reply, aiWritten: true });

    const french = ReviewInsightsSchema.parse(
      (await http().get(`/api/v1/catalog/products/${slug}/reviews/insights?lang=fr`).expect(200))
        .body.insights,
    );
    expect(french).toMatchObject({
      summary: 'Les clients adorent le son et le confort ; 1 avis signale des coupures Bluetooth.',
      aiWritten: true,
      reviewCount: 5,
    });
    expect(french.pros.map((p) => p.label)).toEqual(expect.arrayContaining(['Son', 'Confort']));
    expect(french.cons).toEqual([{ label: 'Connectivité', mentions: 1 }]);

    const spanish = ReviewInsightsSchema.parse(
      (
        await http()
          .get(`/api/v1/catalog/products/${slug}/reviews/insights`)
          .set('Accept-Language', 'es-MX,es;q=0.9')
          .expect(200)
      ).body.insights,
    );
    expect(spanish.aiWritten).toBe(false);
    expect(spanish.summary).toMatch(/^El 80\s% de 5 reseñas da 4 o 5 estrellas\./);
    expect(spanish.pros.map((p) => p.label)).toEqual(
      expect.arrayContaining(['Sonido', 'Comodidad']),
    );
  });

  it('skips work when nothing changed', async () => {
    expect(await app.get(ReviewInsightsService).refresh(productId)).toBe('unchanged');
  });
});
