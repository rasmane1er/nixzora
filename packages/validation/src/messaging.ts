import { z } from 'zod';

/**
 * Customer ↔ store messages (p10-12). Everything stays on NIXZORA: neither side sees the other's
 * email, and email addresses or phone numbers typed into a message are taken out.
 */
export const MESSAGE_MAX_LENGTH = 2000;

const body = z.string().trim().min(1).max(MESSAGE_MAX_LENGTH);

export const ConversationStartSchema = z.object({
  /** The store, by its public handle. */
  sellerHandle: z.string().trim().min(2).max(60),
  productId: z.uuid().optional(),
  orderNumber: z
    .string()
    .regex(/^NX-[A-Z0-9]{6}$/)
    .optional(),
  body,
});
export type ConversationStart = z.infer<typeof ConversationStartSchema>;

export const MessageSendSchema = z.object({ body });
export type MessageSend = z.infer<typeof MessageSendSchema>;

export const ConversationReportSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});
export type ConversationReport = z.infer<typeof ConversationReportSchema>;

export type MessageAuthor = 'CUSTOMER' | 'SELLER' | 'STAFF';

export type ConversationSummary = {
  id: string;
  subject: string;
  /** The other side: the store for customers, the customer's first name for stores. */
  with: string;
  sellerHandle: string;
  product: { slug: string; title: string; imageUrl: string | null } | null;
  orderNumber: string | null;
  lastMessage: { author: MessageAuthor; body: string; at: string } | null;
  unread: boolean;
  closed: boolean;
};

export type ConversationView = ConversationSummary & {
  messages: { id: string; author: MessageAuthor; body: string; redacted: boolean; at: string }[];
  reported: boolean;
};

export type AdminConversationView = ConversationView & {
  customerEmail: string;
  sellerName: string;
  reportReason: string | null;
  hidden: boolean;
};
