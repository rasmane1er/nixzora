import { z } from 'zod';
import { EmailSchema } from './auth';

/**
 * E-gift cards and the gift card balance (p10-10). Cards are bought for a whole-dollar amount,
 * emailed to the recipient with a code, and redeemed into an account's balance, which checkout
 * spends first. No expiry and no fees.
 */
export const GIFT_CARD_MIN_CENTS = 1_000;
export const GIFT_CARD_MAX_CENTS = 50_000;
export const GIFT_CARD_AMOUNTS = [2_500, 5_000, 10_000, 20_000] as const;

export const GiftCardPurchaseSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(GIFT_CARD_MIN_CENTS)
    .max(GIFT_CARD_MAX_CENTS)
    .refine((cents) => cents % 100 === 0, 'Choose a whole-dollar amount.'),
  recipientEmail: EmailSchema,
  recipientName: z.string().trim().min(1).max(60),
  senderName: z.string().trim().min(1).max(60),
  message: z.string().trim().max(300).nullable().optional(),
  /** Pay with a saved card (p10-09) instead of the payment form. */
  paymentCardId: z.uuid().optional(),
});
export type GiftCardPurchase = z.infer<typeof GiftCardPurchaseSchema>;

/** "ABCD-EFGH-JKMN-PQRS"; spaces, dashes and case don't matter. */
export const GiftCardRedeemSchema = z.object({ code: z.string().trim().min(12).max(40) });
export type GiftCardRedeem = z.infer<typeof GiftCardRedeemSchema>;

export const GIFT_ENTRY_KINDS = ['REDEEM', 'SPEND', 'RELEASE', 'REFUND', 'GRANT'] as const;
export type GiftEntryKind = (typeof GIFT_ENTRY_KINDS)[number];

export type GiftBalanceView = {
  balanceCents: number;
  entries: {
    id: string;
    kind: GiftEntryKind;
    amountCents: number;
    note: string | null;
    orderNumber: string | null;
    createdAt: string;
  }[];
};

export type GiftCardStatus = 'PENDING' | 'ACTIVE' | 'REDEEMED' | 'VOID';

/** A gift card on its order (the code is never shown again after the email). */
export type GiftCardLine = {
  id: string;
  amountCents: number;
  recipientName: string;
  recipientEmail: string;
  status: GiftCardStatus;
  last4: string | null;
  sentAt: string | null;
};

// ───── Ops ─────

export const GiftCreditGrantSchema = z.object({
  amountCents: z.number().int().min(100).max(GIFT_CARD_MAX_CENTS),
  note: z.string().trim().min(3).max(200),
});
export type GiftCreditGrant = z.infer<typeof GiftCreditGrantSchema>;

export type AdminGiftCardView = GiftCardLine & {
  orderNumber: string;
  senderName: string;
  purchaserEmail: string;
  redeemedAt: string | null;
  createdAt: string;
};
