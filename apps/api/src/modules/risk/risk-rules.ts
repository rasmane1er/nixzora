import { type RiskSignal } from '@nixzora/validation';

/**
 * Fraud rules (ADR-0024): plain facts in, scored signals out. No I/O here, so every rule is unit
 * tested and the thresholds are easy to read and tune. Points add up; the decision depends on the
 * total (RISK_REVIEW_SCORE, RISK_BLOCK_SCORE).
 */

const DOLLARS = 100;

export type CheckoutFacts = {
  totalCents: number;
  /** Null for a guest. */
  accountAgeHours: number | null;
  /** Paid orders the customer has had before, none of them confirmed as fraud. */
  paidOrders: number;
  averagePaidCents: number;
  /** False for loopback and private addresses (tests, internal calls): IP rules are skipped. */
  ipKnown: boolean;
  /** Earlier checkouts in the last hour from the same IP / the same email. */
  checkoutsFromIp1h: number;
  checkoutsFromEmail1h: number;
  /** Different emails used for checkouts from this IP in the last 24 hours, this one included. */
  emailsFromIp24h: number;
  /** Failed payments in the last 24 hours on orders from this email or IP. */
  failedPayments24h: number;
  /** This email, account or IP was behind an order confirmed as fraud. */
  priorFraud: boolean;
  maxLineQuantity: number;
  disposableEmail: boolean;
};

export function checkoutSignals(f: CheckoutFacts): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const add = (code: RiskSignal['code'], points: number, values?: RiskSignal['values']) =>
    signals.push(values ? { code, points, values } : { code, points });

  if (f.priorFraud) add('prior_fraud', 80);

  // Card testing: many attempts, many failures, many identities from one place.
  if (f.ipKnown) {
    if (f.checkoutsFromIp1h >= 10) add('ip_velocity', 40, { checkouts: f.checkoutsFromIp1h });
    else if (f.checkoutsFromIp1h >= 5) add('ip_velocity', 20, { checkouts: f.checkoutsFromIp1h });
    if (f.emailsFromIp24h >= 5) add('emails_per_ip', 30, { emails: f.emailsFromIp24h });
    else if (f.emailsFromIp24h >= 3) add('emails_per_ip', 15, { emails: f.emailsFromIp24h });
  }
  if (f.checkoutsFromEmail1h >= 5) {
    add('email_velocity', 25, { checkouts: f.checkoutsFromEmail1h });
  }
  if (f.failedPayments24h >= 5) add('failed_payments', 45, { failed: f.failedPayments24h });
  else if (f.failedPayments24h >= 3) add('failed_payments', 25, { failed: f.failedPayments24h });

  // Stolen cards buy a lot, fast, from new identities.
  if (f.accountAgeHours !== null && f.accountAgeHours < 24 && f.totalCents >= 500 * DOLLARS) {
    add('new_account_high_value', 20, {
      totalCents: f.totalCents,
      hours: Math.floor(f.accountAgeHours),
    });
  }
  if (f.accountAgeHours === null && f.totalCents >= 1000 * DOLLARS) {
    add('guest_high_value', 15, { totalCents: f.totalCents });
  }
  if (f.totalCents >= 3000 * DOLLARS) add('high_value', 20, { totalCents: f.totalCents });
  if (f.paidOrders >= 2 && f.totalCents >= 300 * DOLLARS && f.totalCents > 5 * f.averagePaidCents) {
    add('above_usual', 15, { totalCents: f.totalCents, averageCents: f.averagePaidCents });
  }
  if (f.maxLineQuantity >= 10) add('bulk_quantity', 15, { quantity: f.maxLineQuantity });
  if (f.disposableEmail) add('disposable_email', 20);

  // A history of good orders makes one odd signal less telling.
  if (f.paidOrders >= 3 && !f.priorFraud) add('trusted_customer', -25, { orders: f.paidOrders });
  return signals;
}

/** Stripe Radar's verdict on the card payment, added to the checkout's own signals. */
export function paymentRiskSignal(level: string | null | undefined): RiskSignal | null {
  if (level === 'highest') return { code: 'radar_highest', points: 60 };
  if (level === 'elevated') return { code: 'radar_elevated', points: 30 };
  return null;
}

export type PayoutFacts = {
  amountCents: number;
  /** Days since the store was approved. */
  storeAgeDays: number;
  sellerOrders30d: number;
  /** Store orders in the last 30 days that were cancelled or (partly) refunded. */
  refundedOrders30d: number;
  sales7dCents: number;
  /** Average weekly sales over the 8 weeks before the last 7 days. */
  averageWeeklyCents: number;
  /** Full weeks of sales history before the last 7 days (0 to 8). */
  weeksOfHistory: number;
  /** Orders bought by the store's own members. */
  selfPurchases: number;
  chargebacks90d: number;
  fraudOrders90d: number;
};

export function payoutSignals(f: PayoutFacts): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const add = (code: RiskSignal['code'], points: number, values?: RiskSignal['values']) =>
    signals.push(values ? { code, points, values } : { code, points });

  if (f.fraudOrders90d > 0) add('store_fraud_orders', 50, { orders: f.fraudOrders90d });
  if (f.chargebacks90d > 0) {
    add('store_chargebacks', Math.min(60, 30 * f.chargebacks90d), { disputes: f.chargebacks90d });
  }
  if (f.selfPurchases > 0) add('self_purchase', 40, { orders: f.selfPurchases });
  if (f.storeAgeDays < 30 && f.amountCents >= 1000 * DOLLARS) {
    add('new_store_large_payout', 25, {
      amountCents: f.amountCents,
      days: Math.floor(f.storeAgeDays),
    });
  }
  if (f.sellerOrders30d >= 5) {
    const rate = f.refundedOrders30d / f.sellerOrders30d;
    const values = { refunded: f.refundedOrders30d, orders: f.sellerOrders30d };
    if (rate >= 0.4) add('refund_rate', 40, values);
    else if (rate >= 0.2) add('refund_rate', 25, values);
  }
  const spike =
    f.weeksOfHistory >= 2
      ? f.sales7dCents >= 1000 * DOLLARS && f.sales7dCents > 5 * f.averageWeeklyCents
      : f.sales7dCents >= 5000 * DOLLARS;
  if (spike) {
    add('sales_spike', 20, { salesCents: f.sales7dCents, averageCents: f.averageWeeklyCents });
  }
  return signals;
}

export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK';

export const scoreOf = (signals: RiskSignal[]): number =>
  Math.max(
    0,
    signals.reduce((sum, signal) => sum + signal.points, 0),
  );

export function decide(score: number, thresholds: { review: number; block: number }): Decision {
  if (score >= thresholds.block) return 'BLOCK';
  if (score >= thresholds.review) return 'REVIEW';
  return 'ALLOW';
}

/** Throwaway inbox services. Short on purpose: the score never rests on this alone. */
const DISPOSABLE = new Set([
  '10minutemail.com',
  'dispostable.com',
  'getnada.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'mintemail.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? '';
  return DISPOSABLE.has(domain);
}

/** Loopback, private, link-local and unique-local addresses: not a shopper's public IP. */
export function isPublicIp(ip: string | null): ip is string {
  if (!ip) return false;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split('.').map(Number) as [number, number];
    return !(
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return !(lower === '::1' || lower === '::' || /^f[cd]/.test(lower) || lower.startsWith('fe80'));
}
