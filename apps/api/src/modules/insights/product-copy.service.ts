import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ProductCopySuggestion } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { LANGUAGE_MODEL, type LanguageModel } from '../assistant/language-model';
import { checkCopy, type ProductFacts, templateCopy } from './product-copy';

/** Drafts product descriptions for staff (p6-03). The draft is returned, never saved. */
@Injectable()
export class ProductCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: AiUsageService,
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
  ) {}

  async suggest(productId: string): Promise<ProductCopySuggestion> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, brand: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const facts: ProductFacts = {
      title: product.title,
      category: product.category.name,
      brand: product.brand?.name ?? null,
      description: product.description,
      attributes: (product.attributes ?? {}) as Record<string, unknown>,
    };
    const fallback = (notes: string[] = []): ProductCopySuggestion => ({
      description: templateCopy(facts),
      aiWritten: false,
      model: 'local',
      notes,
    });
    if (this.llm.driver === 'local') return fallback();
    if (!(await this.usage.withinBudget())) {
      return fallback(["Today's AI budget is used up, so this draft comes from the specs alone."]);
    }

    const started = Date.now();
    try {
      const { text, usage } = await this.llm.writeProductCopy(facts);
      const checked = checkCopy(text, facts);
      const grounded = 'text' in checked;
      await this.usage.record({
        feature: 'product_copy',
        driver: this.llm.driver,
        model: this.llm.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - started,
        grounded,
      });
      if (!grounded) {
        return fallback([`The AI draft was set aside (${checked.problems.join('; ')}).`]);
      }
      return { description: checked.text, aiWritten: true, model: this.llm.model, notes: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.usage.record({
        feature: 'product_copy',
        driver: this.llm.driver,
        model: this.llm.model,
        latencyMs: Date.now() - started,
        error: message.slice(0, 200),
      });
      return fallback(['The AI service did not answer, so this draft comes from the specs alone.']);
    }
  }
}
