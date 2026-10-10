import { z } from 'zod';
import { type OrderStatus, type TrackingStep } from './commerce';
import { type DeliveryWindow } from './delivery';

/**
 * The help agent (p10-20): a support chat that answers from the shopper's real orders, does the
 * safe things itself (track, cancel a just-placed order, point to the return form, refund
 * status) and hands the conversation to staff when it can't.
 */
export const HELP_INTENTS = [
  'TRACK',
  'CANCEL',
  'RETURN',
  'REFUND',
  'ORDERS',
  'HUMAN',
  'GREETING',
  'OTHER',
] as const;
export type HelpIntent = (typeof HELP_INTENTS)[number];

const OrderNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^NX-[A-Z0-9]{6}$/);

export const HelpMessageCreateSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
export type HelpMessageCreate = z.infer<typeof HelpMessageCreateSchema>;

/** Buttons the shopper presses: the agent never cancels or hands off on words alone. */
export const HelpActionSchema = z.discriminatedUnion('kind', [
  /** Cancel a just-placed order (the client asks "Are you sure?" first). */
  z.object({ kind: z.literal('cancel'), orderNumber: OrderNumber }),
  /** Send the conversation to the support team. */
  z.object({ kind: z.literal('handoff') }),
  /** Pick one of several orders for what was asked. */
  z.object({
    kind: z.literal('choose'),
    intent: z.enum(['TRACK', 'CANCEL', 'RETURN', 'REFUND']),
    orderNumber: OrderNumber,
  }),
]);
export type HelpAction = z.infer<typeof HelpActionSchema>;

/** One order as the agent shows it: facts only, from the database. */
export type HelpOrderCard = {
  number: string;
  status: OrderStatus;
  placedAt: string | null;
  itemCount: number;
  /** The first item titles (at most two). */
  items: string[];
  totalCents: number;
  currency: string;
  estimatedDelivery: DeliveryWindow | null;
  tracking: { carrier: string; number: string; url: string | null } | null;
  /** The latest carrier scan. */
  lastScan: TrackingStep | null;
};

/**
 * What a button does. `order` and `return` open the order page (its return form); `track` the
 * carrier's page; `cancel`, `handoff` and `choose` post a HelpAction; `contact` opens the
 * contact form.
 */
export type HelpButton =
  | { kind: 'order' | 'return' | 'track'; orderNumber: string; url?: string | null }
  | { kind: 'cancel'; orderNumber: string }
  | {
      kind: 'choose';
      intent: Extract<HelpAction, { kind: 'choose' }>['intent'];
      orderNumber: string;
    }
  | { kind: 'handoff' | 'contact' | 'orders' };

export type HelpTurn = {
  id: string;
  role: 'USER' | 'AGENT';
  text: string;
  orders: HelpOrderCard[];
  buttons: HelpButton[];
  at: string;
};

export type HelpConversation = {
  /** null until the shopper writes. */
  id: string | null;
  status: 'OPEN' | 'HANDED_OFF';
  /** The support request it was handed to (S-XXXXXX). */
  supportReference: string | null;
  turns: HelpTurn[];
};
