import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AnswerRole,
  type AnswerView,
  type QuestionListQuery,
  type QuestionPage,
  type QuestionView,
  type QuestionWithProduct,
  totalPages,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { authorName, ReviewsService } from './reviews.service';

const PAGE_SIZE = 10;
/** Questions one customer can ask in a day, across all products. */
const DAILY_QUESTIONS = 10;

const questionInclude = {
  user: { select: { firstName: true, lastName: true } },
  product: {
    select: { id: true, slug: true, title: true, seller: { select: { displayName: true } } },
  },
  answers: {
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.ProductQuestionInclude;
type QuestionRow = Prisma.ProductQuestionGetPayload<{ include: typeof questionInclude }>;

/** Seller answers first, then staff, then buyers; oldest first within each. */
const ROLE_ORDER: Record<AnswerRole, number> = { SELLER: 0, STAFF: 1, BUYER: 2 };

function toView(row: QuestionRow): QuestionView {
  const answers: AnswerView[] = row.answers
    .map((answer) => ({
      id: answer.id,
      body: answer.body,
      role: answer.role as AnswerRole,
      author:
        answer.role === 'SELLER'
          ? (row.product.seller?.displayName ?? 'NIXZORA')
          : answer.role === 'STAFF'
            ? 'NIXZORA'
            : authorName(answer.user),
      createdAt: answer.createdAt.toISOString(),
    }))
    .sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.localeCompare(b.createdAt),
    );
  return {
    id: row.id,
    body: row.body,
    author: authorName(row.user),
    createdAt: row.createdAt.toISOString(),
    answers,
  };
}

/**
 * Customer questions and answers on product pages (p10-05). Anyone signed in can ask; the
 * store selling the product, NIXZORA staff and customers who received it can answer. Posts go
 * live at once; staff hide anything that breaks the rules.
 */
@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly audit: AuditService,
  ) {}

  private async product(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, sellerId: true },
    });
    if (!product) throw new NotFoundException('We could not find that product.');
    return product;
  }

  /** How this customer may answer questions about the product, or null when they may not. */
  async roleFor(
    product: { id: string; sellerId: string | null },
    user: AuthUser | undefined,
  ): Promise<AnswerRole | null> {
    if (!user) return null;
    if (product.sellerId) {
      const member = await this.prisma.sellerMember.findFirst({
        where: { userId: user.id, sellerId: product.sellerId },
        select: { userId: true },
      });
      if (member) return 'SELLER';
    } else if (user.permissions.includes('catalog.write')) {
      // NIXZORA sells it: its catalog staff answer as the seller.
      return 'SELLER';
    }
    if (user.permissions.includes('reviews.moderate')) return 'STAFF';
    return (await this.reviews.received(product.id, user.id)) ? 'BUYER' : null;
  }

  async list(slug: string, query: QuestionListQuery, user?: AuthUser): Promise<QuestionPage> {
    const product = await this.product(slug);
    const search = query.q
      ? {
          OR: [
            { body: { contains: query.q, mode: 'insensitive' as const } },
            {
              answers: {
                some: {
                  status: 'PUBLISHED' as const,
                  body: { contains: query.q, mode: 'insensitive' as const },
                },
              },
            },
          ],
        }
      : {};
    const where = { productId: product.id, status: 'PUBLISHED' as const, ...search };
    const [total, rows, role] = await Promise.all([
      this.prisma.productQuestion.count({ where }),
      this.prisma.productQuestion.findMany({
        where,
        include: questionInclude,
        orderBy: [{ answerCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.roleFor(product, user),
    ]);
    return {
      questions: rows.map(toView),
      page: query.page,
      totalPages: totalPages(total, PAGE_SIZE),
      total,
      canAnswer: role !== null,
    };
  }

  async ask(slug: string, body: string, user: AuthUser): Promise<QuestionView> {
    const product = await this.product(slug);
    const today = await this.prisma.productQuestion.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
    });
    if (today >= DAILY_QUESTIONS) {
      throw new ForbiddenException('You have asked a lot of questions today. Try again tomorrow.');
    }
    const row = await this.prisma.productQuestion.create({
      data: { productId: product.id, userId: user.id, body },
      include: questionInclude,
    });
    return toView(row);
  }

  async answer(questionId: string, body: string, user: AuthUser): Promise<QuestionView> {
    const question = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, status: 'PUBLISHED', product: { status: 'ACTIVE' } },
      select: { product: { select: { id: true, sellerId: true } } },
    });
    if (!question) throw new NotFoundException('We could not find that question.');
    const role = await this.roleFor(question.product, user);
    if (!role) {
      throw new ForbiddenException(
        'Only customers who received this product, or the store selling it, can answer.',
      );
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.productAnswer.create({ data: { questionId, userId: user.id, role, body } });
      return tx.productQuestion.update({
        where: { id: questionId },
        data: { answerCount: { increment: 1 } },
        include: questionInclude,
      });
    });
    return toView(row);
  }

  // ───── Stores and staff ─────

  /** The signed-in member's store's unanswered questions (seller portal). */
  async unansweredForMember(userId: string): Promise<QuestionWithProduct[]> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId },
      select: { sellerId: true },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    return this.unansweredForSeller(member.sellerId);
  }

  /** A store's unanswered questions (no answer from the store yet), newest first. */
  async unansweredForSeller(sellerId: string): Promise<QuestionWithProduct[]> {
    const rows = await this.prisma.productQuestion.findMany({
      where: {
        status: 'PUBLISHED',
        product: { sellerId, status: 'ACTIVE' },
        answers: { none: { role: 'SELLER', status: 'PUBLISHED' } },
      },
      include: questionInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({ ...toView(row), status: row.status, product: row.product }));
  }

  /** The latest questions everywhere, with their answers, for staff review. */
  async latest(): Promise<QuestionWithProduct[]> {
    const rows = await this.prisma.productQuestion.findMany({
      include: questionInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({ ...toView(row), status: row.status, product: row.product }));
  }

  async hideQuestion(id: string, actor: ActorContext): Promise<void> {
    const found = await this.prisma.productQuestion.updateMany({
      where: { id },
      data: { status: 'HIDDEN' },
    });
    if (!found.count) throw new NotFoundException('We could not find that question.');
    await this.audit.recordFor(actor, 'questions.question.hidden', 'product_question', id);
  }

  async hideAnswer(id: string, actor: ActorContext): Promise<void> {
    const answer = await this.prisma.productAnswer.findUnique({ where: { id } });
    if (!answer) throw new NotFoundException('We could not find that answer.');
    if (answer.status === 'PUBLISHED') {
      await this.prisma.$transaction([
        this.prisma.productAnswer.update({ where: { id }, data: { status: 'HIDDEN' } }),
        this.prisma.productQuestion.update({
          where: { id: answer.questionId },
          data: { answerCount: { decrement: 1 } },
        }),
      ]);
    }
    await this.audit.recordFor(actor, 'questions.answer.hidden', 'product_answer', id);
  }
}
