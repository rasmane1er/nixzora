import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { deliveryRange, formatters, type Locale, translator } from '@nixzora/i18n';
import {
  type HelpAction,
  type HelpButton,
  type HelpConversation,
  type HelpIntent,
  type HelpOrderCard,
  type HelpTurn,
  type OrderView,
  type ReturnView,
  type SupportRequestCreate,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import {
  LANGUAGE_MODEL,
  type LanguageModel,
  LocalLanguageModel,
  type Usage,
} from '../assistant/language-model';
import { type AuthUser } from '../identity/auth-user';
import { orderInclude, type OrderRow } from '../orders/order-links';
import { OrdersService } from '../orders/orders.service';
import { ReturnsService } from '../orders/returns.service';
import { SupportService } from '../support/support.service';
import { type HelpOrderRef, type HelpUnderstanding } from './help-intent';

/** Recent orders the agent looks at (an order quoted by number is found even if older). */
const RECENT_ORDERS = 8;
/** A conversation this long asks the shopper to start over. */
const MAX_MESSAGES = 80;
const ORDER_NUMBER = /\bNX-[A-Z0-9]{6}\b/i;
const ON_THE_WAY = new Set(['PAID', 'FULFILLING', 'SHIPPED']);
const THANKS = /thank|merci|gracias/i;

type Reply = { text: string; orders?: HelpOrderCard[]; buttons?: HelpButton[]; focus?: string };
const helpT = (locale: Locale) => translator(locale)('helpAgent');
type Ctx = {
  userId: string;
  locale: Locale;
  t: ReturnType<typeof helpT>;
  f: ReturnType<typeof formatters>;
};
type MessageData = { orders?: HelpOrderCard[]; buttons?: HelpButton[] };
type ConversationRow = Prisma.HelpConversationGetPayload<{
  include: { messages: true; supportRequest: { select: { reference: true } } };
}>;

/**
 * The help agent (p10-20, ADR-0042). A model (or the free keyword rules) only reads what the
 * shopper wants and which order; every reply is written here from the order, its shipments and
 * returns, so it can't promise a date or a refund the data doesn't show. Cancelling and handing
 * off happen only when the shopper presses the button.
 */
@Injectable()
export class HelpService {
  private readonly logger = new Logger(HelpService.name);
  private readonly local = new LocalLanguageModel();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
    private readonly support: SupportService,
    private readonly usage: AiUsageService,
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
  ) {}

  async current(userId: string, locale: Locale): Promise<HelpConversation> {
    return this.view(await this.find(userId), locale);
  }

  /** Leaves the current conversation (it stays with staff if it was handed off). */
  async startOver(userId: string): Promise<void> {
    await this.prisma.helpConversation.updateMany({
      where: { userId, status: { in: ['OPEN', 'HANDED_OFF'] } },
      data: { status: 'CLOSED' },
    });
  }

  async send(user: AuthUser, text: string, locale: Locale): Promise<HelpConversation> {
    const ctx = this.ctx(user.id, locale);
    const conversation = await this.open(user.id);
    await this.say(conversation.id, 'USER', text);
    const recent = await this.recentOrders(user.id);
    const turns = [
      ...conversation.messages.filter((m) => m.role === 'USER').map((m) => m.text),
      text,
    ].slice(-6);
    const understood = await this.understand(turns, recent, locale);

    // An order quoted by number that isn't among the recent ones: an older one of theirs, or not.
    const written = text.match(ORDER_NUMBER)?.[0]?.toUpperCase();
    let orderNumber = understood.orderNumber;
    if (written && !orderNumber) {
      const older = await this.orderFor(user.id, written);
      if (!older) {
        return this.reply(conversation.id, understood.intent, ctx, {
          text: ctx.t('notYours', { number: written }),
          buttons: [{ kind: 'orders' }],
        });
      }
      recent.push(older);
      orderNumber = written;
    }
    // "Cancel it": the order the conversation is already about, when it fits the question.
    const context = recent.find((o) => o.number === conversation.orderNumber);
    if (!orderNumber && context && fits(understood.intent, context)) {
      orderNumber = context.number;
    }
    const reply = await this.answer(
      understood.intent,
      orderNumber,
      recent,
      ctx,
      conversation,
      text,
    );
    return this.reply(conversation.id, understood.intent, ctx, reply);
  }

  async act(user: AuthUser, action: HelpAction, locale: Locale): Promise<HelpConversation> {
    const ctx = this.ctx(user.id, locale);
    const conversation = await this.open(user.id);
    if (action.kind === 'handoff') {
      await this.say(conversation.id, 'USER', ctx.t('btn_handoff'));
      return this.reply(conversation.id, 'HUMAN', ctx, await this.handOff(user, conversation, ctx));
    }
    await this.say(
      conversation.id,
      'USER',
      action.kind === 'cancel'
        ? `${ctx.t('btn_cancel')} ${action.orderNumber}`
        : action.orderNumber,
    );
    const view = await this.orderFor(user.id, action.orderNumber);
    if (!view) {
      return this.reply(conversation.id, 'OTHER', ctx, {
        text: ctx.t('notYours', { number: action.orderNumber }),
      });
    }
    if (action.kind === 'choose') {
      const reply = await this.forOrder(action.intent, view, ctx);
      return this.reply(conversation.id, action.intent, ctx, reply);
    }
    // Cancel: the same rules as the order page (paid, within 30 minutes, nothing packed).
    const row = await this.orders.byNumberForUser(view.number, user.id);
    try {
      const cancelled = await this.orders.customerCancel(row);
      return this.reply(conversation.id, 'CANCEL', ctx, {
        text: ctx.t('cancelDone', {
          number: cancelled.number,
          amount: ctx.f.money(cancelled.totalCents, cancelled.currency),
        }),
        orders: [card(cancelled)],
        buttons: [{ kind: 'order', orderNumber: cancelled.number }],
        focus: cancelled.number,
      });
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      // Too late after all: say why, from the order as it is now.
      const now = await this.orderFor(user.id, view.number);
      return this.reply(conversation.id, 'CANCEL', ctx, this.cancel(now ?? view, ctx));
    }
  }

  // ───────────── Reading the message ─────────────

  private async understand(
    turns: string[],
    recent: OrderView[],
    locale: Locale,
  ): Promise<HelpUnderstanding> {
    const orders: HelpOrderRef[] = recent.map((o) => ({
      number: o.number,
      status: o.status,
      items: o.items.slice(0, 2).map((i) => i.productTitle),
    }));
    const input = { turns, orders, ...(locale === 'en' ? {} : { locale }) };
    const model =
      this.llm.driver === 'local' || !(await this.usage.withinBudget()) ? this.local : this.llm;
    if (model.driver === 'local') return model.classifyHelp(input);
    const started = Date.now();
    let usage: Usage | undefined;
    let error: string | undefined;
    try {
      const result = await model.classifyHelp(input);
      usage = result.usage;
      return { intent: result.intent, orderNumber: result.orderNumber };
    } catch (failure) {
      error = (failure as Error).message;
      this.logger.warn(`Help model failed, using the keyword rules: ${error}`);
      return this.local.classifyHelp(input);
    } finally {
      await this.usage.record({
        feature: 'help',
        driver: model.driver,
        model: model.model,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs: Date.now() - started,
        ...(error ? { error } : {}),
      });
    }
  }

  // ───────────── Answers ─────────────

  private async answer(
    intent: HelpIntent,
    orderNumber: string | null,
    recent: OrderView[],
    ctx: Ctx,
    conversation: ConversationRow,
    latest: string,
  ): Promise<Reply> {
    const { t } = ctx;
    if (intent === 'GREETING') {
      return { text: THANKS.test(latest) ? t('thanks') : t('welcome') };
    }
    if (intent === 'HUMAN') {
      if (conversation.supportRequest) {
        return {
          text: t('handoffAlready', { reference: conversation.supportRequest.reference }),
        };
      }
      return { text: t('humanOffer'), buttons: [{ kind: 'handoff' }] };
    }
    if (intent === 'OTHER') {
      return { text: t('other'), buttons: [{ kind: 'handoff' }, { kind: 'contact' }] };
    }
    if (!recent.length) return { text: t('noOrders'), buttons: [{ kind: 'contact' }] };

    const chosen = orderNumber ? recent.find((o) => o.number === orderNumber) : undefined;
    if (chosen && intent !== 'ORDERS') return this.forOrder(intent, chosen, ctx);
    if (chosen) return { text: t('ordersList'), orders: [card(chosen)], focus: chosen.number };

    switch (intent) {
      case 'TRACK': {
        const moving = recent.filter((o) => ON_THE_WAY.has(o.status));
        if (moving.length === 1) return this.track(moving[0]!, ctx);
        if (moving.length > 1) {
          return this.choose(t('severalOnTheWay', { count: moving.length }), 'TRACK', moving);
        }
        return this.choose(t('noneOnTheWay'), 'TRACK', recent.slice(0, 3));
      }
      case 'CANCEL': {
        const open = recent.filter((o) => o.cancellableUntil);
        if (open.length === 1) return this.cancel(open[0]!, ctx);
        if (open.length > 1) return this.choose(t('pickOrder'), 'CANCEL', open);
        // Nothing can be cancelled any more: explain on the latest live order, if any.
        const latest = recent.find((o) => ON_THE_WAY.has(o.status));
        if (latest) return this.cancel(latest, ctx);
        return { text: t('cancelNone'), buttons: [{ kind: 'orders' }] };
      }
      case 'RETURN': {
        const returnable = recent.filter((o) => o.returnableUntil);
        if (returnable.length === 1) return this.forOrder('RETURN', returnable[0]!, ctx);
        if (returnable.length > 1) return this.choose(t('pickOrder'), 'RETURN', returnable);
        return { text: t('returnNone'), buttons: [{ kind: 'orders' }, { kind: 'handoff' }] };
      }
      case 'REFUND':
        return this.refunds(recent, ctx);
      default:
        return { text: t('ordersList'), orders: recent.slice(0, 3).map(card) };
    }
  }

  private async forOrder(intent: HelpIntent, order: OrderView, ctx: Ctx): Promise<Reply> {
    if (intent === 'CANCEL') return this.cancel(order, ctx);
    if (intent === 'RETURN' || intent === 'REFUND') {
      const returns = await this.returns.forOrder(order.id);
      return intent === 'RETURN'
        ? this.returnFor(order, returns, ctx)
        : this.refundFor(order, returns, ctx);
    }
    if (intent === 'ORDERS') return { text: ctx.t('ordersList'), orders: [card(order)] };
    return this.track(order, ctx);
  }

  private choose(
    text: string,
    intent: Extract<HelpButton, { kind: 'choose' }>['intent'],
    orders: OrderView[],
  ): Reply {
    const shown = orders.slice(0, 4);
    return {
      text,
      orders: shown.map(card),
      buttons: shown.map((o) => ({ kind: 'choose' as const, intent, orderNumber: o.number })),
    };
  }

  private track(order: OrderView, ctx: Ctx): Reply {
    const { t, f } = ctx;
    const number = order.number;
    const base = { orders: [card(order)], focus: number };
    const orderButton: HelpButton = { kind: 'order', orderNumber: number };
    switch (order.status) {
      case 'PENDING_PAYMENT':
        return { ...base, text: t('awaitingPayment', { number }), buttons: [orderButton] };
      case 'CANCELLED':
        return { ...base, text: this.cancelledText(order, ctx), buttons: [orderButton] };
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return {
          ...base,
          text: `${t('orderRefunded', { number, amount: f.money(order.refundedCents, order.currency) })} ${t('refundBank')}`,
          buttons: [orderButton],
        };
      case 'DELIVERED': {
        const at = order.timeline.findLast((s) => s.status === 'DELIVERED')?.at;
        return {
          ...base,
          text: `${at ? t('trackDelivered', { number, date: f.date(at) }) : t('trackDeliveredUndated', { number })} ${t('deliveredMissing')}`,
          buttons: [
            orderButton,
            ...(order.returnableUntil ? [{ kind: 'return' as const, orderNumber: number }] : []),
            { kind: 'handoff' },
          ],
        };
      }
    }
    const lines: string[] = [];
    if (order.shipments.length > 1) {
      lines.push(t('trackParts', { number, count: order.shipments.length }));
      for (const part of order.shipments) {
        const state =
          part.status === 'SHIPPED'
            ? part.tracking
              ? t('partShipped', { carrier: part.tracking.carrier })
              : t('partShippedPlain')
            : part.status === 'DELIVERED'
              ? t('partDelivered')
              : part.status === 'CANCELLED'
                ? t('partCancelled')
                : t('partPreparing');
        lines.push(t('part', { from: part.seller?.displayName ?? t('partFromNixzora'), state }));
      }
    } else {
      const tracking = trackingOf(order);
      lines.push(
        order.status === 'SHIPPED'
          ? tracking
            ? t('trackShipped', { number, carrier: tracking.carrier })
            : t('trackShippedPlain', { number })
          : t('trackPreparing', { number }),
      );
    }
    const scan = lastScanOf(order);
    if (scan) {
      const vars = { date: f.date(scan.at), description: scan.description };
      lines.push(
        scan.location
          ? t('lastScanPlace', { ...vars, location: scan.location })
          : t('lastScan', vars),
      );
    }
    const window = estimateOf(order);
    if (window) lines.push(t('expected', { window: deliveryRange(window, ctx.locale) }));
    const tracking = trackingOf(order);
    return {
      ...base,
      text: lines.join(' '),
      buttons: [
        ...(tracking?.url
          ? [{ kind: 'track' as const, orderNumber: number, url: tracking.url }]
          : []),
        orderButton,
        ...(order.cancellableUntil ? [{ kind: 'cancel' as const, orderNumber: number }] : []),
      ],
    };
  }

  private cancel(order: OrderView, ctx: Ctx): Reply {
    const { t } = ctx;
    const number = order.number;
    const base = { orders: [card(order)], focus: number };
    const orderButton: HelpButton = { kind: 'order', orderNumber: number };
    if (order.cancellableUntil) {
      const minutes = Math.max(
        1,
        Math.ceil((Date.parse(order.cancellableUntil) - Date.now()) / 60_000),
      );
      return {
        ...base,
        text: t('cancelCan', { number, minutes }),
        buttons: [{ kind: 'cancel', orderNumber: number }, orderButton],
      };
    }
    switch (order.status) {
      case 'CANCELLED':
        return { ...base, text: t('cancelAlready', { number }), buttons: [orderButton] };
      case 'DELIVERED':
        return {
          ...base,
          text: t('cancelDelivered', { number }),
          buttons: order.returnableUntil
            ? [{ kind: 'return', orderNumber: number }, orderButton]
            : [orderButton],
        };
      case 'SHIPPED':
        return { ...base, text: t('cancelShipped', { number }), buttons: [orderButton] };
      case 'PAID':
      case 'FULFILLING':
        return {
          ...base,
          text: t('cancelPacked', { number }),
          buttons: [{ kind: 'handoff' }, orderButton],
        };
      case 'PENDING_PAYMENT':
        return { ...base, text: t('awaitingPayment', { number }), buttons: [orderButton] };
      default:
        return this.track(order, ctx);
    }
  }

  private returnFor(order: OrderView, returns: ReturnView[], ctx: Ctx): Reply {
    const { t, f } = ctx;
    const number = order.number;
    const base = { orders: [card(order)], focus: number };
    const orderButton: HelpButton = { kind: 'order', orderNumber: number };
    const latest = returns[0];
    if (latest && latest.status !== 'REJECTED') {
      return {
        ...base,
        text: t('returnOpen', { number, state: this.returnState(latest, ctx) }),
        buttons: [orderButton],
      };
    }
    if (order.returnableUntil) {
      return {
        ...base,
        text: t('returnCan', { number, date: f.date(order.returnableUntil) }),
        buttons: [{ kind: 'return', orderNumber: number }],
      };
    }
    if (order.status === 'DELIVERED') {
      return {
        ...base,
        text: t('returnClosed', { number }),
        buttons: [{ kind: 'handoff' }, orderButton],
      };
    }
    if (ON_THE_WAY.has(order.status)) {
      return {
        ...base,
        text: t('returnNotYet', { number }),
        buttons: [
          orderButton,
          ...(order.cancellableUntil ? [{ kind: 'cancel' as const, orderNumber: number }] : []),
        ],
      };
    }
    return this.track(order, ctx);
  }

  private refundFor(order: OrderView, returns: ReturnView[], ctx: Ctx): Reply {
    const { t, f } = ctx;
    const latest = returns[0];
    if (latest) {
      return {
        orders: [card(order)],
        focus: order.number,
        text: [
          t('returnOpen', { number: order.number, state: this.returnState(latest, ctx) }),
          ...(latest.status === 'REFUNDED' ? [t('refundBank')] : []),
        ].join(' '),
        buttons: [{ kind: 'order', orderNumber: order.number }],
      };
    }
    if (order.refundedCents > 0) {
      return {
        orders: [card(order)],
        focus: order.number,
        text: `${t('orderRefunded', { number: order.number, amount: f.money(order.refundedCents, order.currency) })} ${t('refundBank')}`,
        buttons: [{ kind: 'order', orderNumber: order.number }],
      };
    }
    return this.returnFor(order, returns, ctx);
  }

  /** Refund status across the account: their latest returns, else refunded orders. */
  private async refunds(recent: OrderView[], ctx: Ctx): Promise<Reply> {
    const { t, f } = ctx;
    const returns = (await this.returns.forUser(ctx.userId)).slice(0, 3);
    if (returns.length) {
      const lines = returns.map((r) =>
        t('returnOpen', { number: r.orderNumber, state: this.returnState(r, ctx) }),
      );
      if (returns.some((r) => r.status === 'REFUNDED')) lines.push(t('refundBank'));
      const numbers = new Set(returns.map((r) => r.orderNumber));
      return {
        text: lines.join(' '),
        orders: recent.filter((o) => numbers.has(o.number)).map(card),
        focus: returns.length === 1 ? returns[0]!.orderNumber : undefined,
      };
    }
    const refunded = recent.filter((o) => o.refundedCents > 0).slice(0, 3);
    if (refunded.length) {
      return {
        text: [
          ...refunded.map((o) =>
            t('orderRefunded', { number: o.number, amount: f.money(o.refundedCents, o.currency) }),
          ),
          t('refundBank'),
        ].join(' '),
        orders: refunded.map(card),
      };
    }
    return { text: t('refundNone'), buttons: [{ kind: 'orders' }, { kind: 'handoff' }] };
  }

  private returnState(r: ReturnView, ctx: Ctx): string {
    const { t, f } = ctx;
    switch (r.status) {
      case 'REQUESTED':
        return t('returnState_REQUESTED', { date: f.date(r.createdAt) });
      case 'REFUNDED':
        return t('returnState_REFUNDED', { amount: f.money(r.refundCents ?? 0) });
      default:
        return t(`returnState_${r.status}`);
    }
  }

  private cancelledText(order: OrderView, ctx: Ctx): string {
    const { t, f } = ctx;
    const number = order.number;
    return order.refundedCents > 0
      ? `${t('orderCancelled', { number })} ${t('orderRefunded', { number, amount: f.money(order.refundedCents, order.currency) })}`
      : t('orderCancelled', { number });
  }

  // ───────────── Handing off ─────────────

  private async handOff(user: AuthUser, conversation: ConversationRow, ctx: Ctx): Promise<Reply> {
    if (conversation.supportRequest) {
      return {
        text: ctx.t('handoffAlready', { reference: conversation.supportRequest.reference }),
      };
    }
    const messages = await this.prisma.helpMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    const firstQuestion =
      messages.find((m) => m.role === 'USER' && m.text !== ctx.t('btn_handoff'))?.text ?? '';
    const lastIntent = [...messages]
      .reverse()
      .find((m) => m.intent && m.intent !== 'HUMAN')?.intent;
    // Staff read the transcript in the Ops Center; the newest part matters most.
    const transcript = messages
      .map((m) => `${m.role === 'USER' ? 'Customer' : 'Help assistant'}: ${m.text}`)
      .join('\n\n');
    const input: SupportRequestCreate = {
      topic:
        lastIntent === 'TRACK'
          ? 'DELIVERY'
          : lastIntent === 'RETURN' || lastIntent === 'REFUND'
            ? 'RETURN'
            : lastIntent === 'CANCEL' || lastIntent === 'ORDERS'
              ? 'ORDER'
              : 'OTHER',
      orderNumber: conversation.orderNumber ?? undefined,
      subject: `Help chat: ${firstQuestion || 'conversation'}`.slice(0, 150),
      message: (transcript.length > 4900 ? `…${transcript.slice(-4900)}` : transcript).padEnd(
        10,
        '.',
      ),
    };
    const request = await this.support.create(input, user, ctx.locale);
    await this.prisma.helpConversation.update({
      where: { id: conversation.id },
      data: { status: 'HANDED_OFF', supportRequestId: request.id },
    });
    return { text: ctx.t('handoffDone', { reference: request.reference }) };
  }

  // ───────────── Storage ─────────────

  private ctx(userId: string, locale: Locale): Ctx {
    return { userId, locale, t: helpT(locale), f: formatters(locale) };
  }

  private find(userId: string): Promise<ConversationRow | null> {
    return this.prisma.helpConversation.findFirst({
      where: { userId, status: { in: ['OPEN', 'HANDED_OFF'] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        supportRequest: { select: { reference: true } },
      },
    });
  }

  private async open(userId: string): Promise<ConversationRow> {
    const found = await this.find(userId);
    if (found && found.messages.length >= MAX_MESSAGES) {
      throw new BadRequestException('This chat is getting long. Start over to ask something new.');
    }
    if (found) return found;
    return this.prisma.helpConversation.create({
      data: { userId },
      include: { messages: true, supportRequest: { select: { reference: true } } },
    });
  }

  private async say(
    conversationId: string,
    role: 'USER' | 'AGENT',
    text: string,
    extra: { intent?: string; data?: MessageData } = {},
  ): Promise<void> {
    await this.prisma.helpMessage.create({
      data: {
        conversationId,
        role,
        text,
        intent: extra.intent ?? null,
        ...(extra.data ? { data: extra.data as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private async reply(
    conversationId: string,
    intent: HelpIntent,
    ctx: Ctx,
    reply: Reply,
  ): Promise<HelpConversation> {
    await this.say(conversationId, 'AGENT', reply.text, {
      intent,
      data: { orders: reply.orders ?? [], buttons: reply.buttons ?? [] },
    });
    await this.prisma.helpConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date(), ...(reply.focus ? { orderNumber: reply.focus } : {}) },
    });
    return this.current(ctx.userId, ctx.locale);
  }

  private async recentOrders(userId: string): Promise<OrderView[]> {
    const rows: OrderRow[] = await this.prisma.order.findMany({
      where: {
        userId,
        kind: 'GOODS',
        NOT: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(Date.now() - 3600_000) } },
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS,
    });
    return Promise.all(rows.map((row) => this.orders.view(row)));
  }

  private async orderFor(userId: string, number: string): Promise<OrderView | null> {
    try {
      return await this.orders.view(await this.orders.byNumberForUser(number, userId));
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private view(row: ConversationRow | null, locale: Locale): HelpConversation {
    const t = helpT(locale);
    const welcome: HelpTurn = {
      id: 'welcome',
      role: 'AGENT',
      text: t('welcome'),
      orders: [],
      buttons: [],
      at: (row?.createdAt ?? new Date()).toISOString(),
    };
    if (!row) return { id: null, status: 'OPEN', supportReference: null, turns: [welcome] };
    return {
      id: row.id,
      status: row.status === 'HANDED_OFF' ? 'HANDED_OFF' : 'OPEN',
      supportReference: row.supportRequest?.reference ?? null,
      turns: [
        welcome,
        ...row.messages.map((m) => {
          const data = (m.data ?? {}) as MessageData;
          return {
            id: m.id,
            role: m.role,
            text: m.text,
            orders: data.orders ?? [],
            buttons: data.buttons ?? [],
            at: m.createdAt.toISOString(),
          };
        }),
      ],
    };
  }
}

/** Whether a follow-up without an order number is still about the order being discussed. */
function fits(intent: HelpIntent, order: OrderView): boolean {
  switch (intent) {
    case 'TRACK':
    case 'CANCEL':
      return true;
    case 'RETURN':
      return Boolean(order.returnableUntil) || order.status === 'DELIVERED';
    case 'REFUND':
      // Otherwise the account-wide answer, which covers this order's returns too.
      return order.refundedCents > 0;
    default:
      return false;
  }
}

function trackingOf(order: OrderView): HelpOrderCard['tracking'] {
  return order.tracking ?? order.shipments.find((s) => s.tracking)?.tracking ?? null;
}

function estimateOf(order: OrderView): HelpOrderCard['estimatedDelivery'] {
  return (
    order.estimatedDelivery ??
    order.shipments.find((s) => s.estimatedDelivery)?.estimatedDelivery ??
    null
  );
}

function lastScanOf(order: OrderView): HelpOrderCard['lastScan'] {
  const scans = [
    ...(order.trackingEvents ?? []),
    ...order.shipments.flatMap((s) => s.events ?? []),
  ];
  return scans.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/** What the chat shows of an order: facts only. */
function card(order: OrderView): HelpOrderCard {
  return {
    number: order.number,
    status: order.status,
    placedAt: order.placedAt,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.slice(0, 2).map((item) => item.productTitle),
    totalCents: order.totalCents,
    currency: order.currency,
    estimatedDelivery: ['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)
      ? null
      : estimateOf(order),
    tracking: trackingOf(order),
    lastScan: lastScanOf(order),
  };
}
