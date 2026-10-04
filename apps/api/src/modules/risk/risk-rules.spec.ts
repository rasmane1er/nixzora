import {
  type CheckoutFacts,
  checkoutSignals,
  decide,
  isDisposableEmail,
  isPublicIp,
  paymentRiskSignal,
  type PayoutFacts,
  payoutSignals,
  scoreOf,
} from './risk-rules';

const thresholds = { review: 50, block: 80 };

const shopper: CheckoutFacts = {
  totalCents: 8_900,
  accountAgeHours: 24 * 90,
  paidOrders: 1,
  averagePaidCents: 6_000,
  ipKnown: true,
  checkoutsFromIp1h: 0,
  checkoutsFromEmail1h: 0,
  emailsFromIp24h: 1,
  failedPayments24h: 0,
  priorFraud: false,
  maxLineQuantity: 1,
  disposableEmail: false,
};

const codes = (signals: { code: string }[]) => signals.map((signal) => signal.code);
const verdict = (facts: Partial<CheckoutFacts>) =>
  decide(scoreOf(checkoutSignals({ ...shopper, ...facts })), thresholds);

describe('checkout rules', () => {
  it('lets an ordinary order through with no signals', () => {
    expect(checkoutSignals(shopper)).toEqual([]);
    expect(verdict({})).toBe('ALLOW');
  });

  it('a customer retrying a declined card is not flagged', () => {
    expect(verdict({ checkoutsFromEmail1h: 2, failedPayments24h: 2 })).toBe('ALLOW');
  });

  it('declines card testing: many attempts and failures from one place', () => {
    const facts = { checkoutsFromIp1h: 12, failedPayments24h: 6, emailsFromIp24h: 6 };
    expect(codes(checkoutSignals({ ...shopper, ...facts }))).toEqual([
      'ip_velocity',
      'emails_per_ip',
      'failed_payments',
    ]);
    expect(verdict(facts)).toBe('BLOCK');
  });

  it('ignores IP rules when the address is not a public one', () => {
    expect(verdict({ ipKnown: false, checkoutsFromIp1h: 40, emailsFromIp24h: 9 })).toBe('ALLOW');
  });

  it('sends a large first order from a throwaway inbox to review', () => {
    const facts = {
      accountAgeHours: null,
      paidOrders: 0,
      totalCents: 120_000,
      disposableEmail: true,
      maxLineQuantity: 10,
    };
    expect(codes(checkoutSignals({ ...shopper, ...facts }))).toEqual([
      'guest_high_value',
      'bulk_quantity',
      'disposable_email',
    ]);
    expect(verdict(facts)).toBe('REVIEW');
  });

  it('blocks anyone tied to confirmed fraud', () => {
    expect(verdict({ priorFraud: true })).toBe('BLOCK');
  });

  it('trusts a customer with a history of good orders', () => {
    const facts = {
      paidOrders: 6,
      averagePaidCents: 40_000,
      totalCents: 45_000,
      disposableEmail: true,
    };
    expect(scoreOf(checkoutSignals({ ...shopper, ...facts }))).toBe(0);
  });

  it('flags an order far above what the customer usually spends', () => {
    const signals = checkoutSignals({
      ...shopper,
      paidOrders: 2,
      averagePaidCents: 5_000,
      totalCents: 60_000,
    });
    expect(codes(signals)).toEqual(['above_usual']);
  });

  it('a new account spending a lot on its first day', () => {
    expect(
      codes(checkoutSignals({ ...shopper, accountAgeHours: 2, paidOrders: 0, totalCents: 70_000 })),
    ).toEqual(['new_account_high_value']);
  });

  it('never scores below zero', () => {
    expect(scoreOf([{ code: 'trusted_customer', points: -25 }])).toBe(0);
  });
});

describe('payment provider verdict', () => {
  it('maps Stripe Radar risk levels', () => {
    expect(paymentRiskSignal('highest')).toEqual({ code: 'radar_highest', points: 60 });
    expect(paymentRiskSignal('elevated')).toEqual({ code: 'radar_elevated', points: 30 });
    expect(paymentRiskSignal('normal')).toBeNull();
    expect(paymentRiskSignal(null)).toBeNull();
  });
});

const store: PayoutFacts = {
  amountCents: 40_000,
  storeAgeDays: 200,
  sellerOrders30d: 30,
  refundedOrders30d: 1,
  sales7dCents: 90_000,
  averageWeeklyCents: 80_000,
  weeksOfHistory: 8,
  selfPurchases: 0,
  chargebacks90d: 0,
  fraudOrders90d: 0,
};

describe('payout rules', () => {
  const score = (facts: Partial<PayoutFacts>) => scoreOf(payoutSignals({ ...store, ...facts }));

  it('pays an established store with normal activity', () => {
    expect(payoutSignals(store)).toEqual([]);
  });

  it('holds a store buying from itself', () => {
    expect(score({ selfPurchases: 2 })).toBeGreaterThanOrEqual(40);
    expect(decide(score({ selfPurchases: 2, refundedOrders30d: 7 }), thresholds)).toBe('REVIEW');
  });

  it('holds a store with confirmed fraud orders', () => {
    expect(decide(score({ fraudOrders90d: 1 }), thresholds)).toBe('REVIEW');
  });

  it('caps chargeback points', () => {
    expect(score({ chargebacks90d: 5 })).toBe(60);
  });

  it('a brand-new store with a big first payout and a sales spike', () => {
    const signals = payoutSignals({
      ...store,
      storeAgeDays: 9,
      amountCents: 600_000,
      weeksOfHistory: 0,
      averageWeeklyCents: 0,
      sales7dCents: 650_000,
    });
    expect(codes(signals)).toEqual(['new_store_large_payout', 'sales_spike']);
  });

  it('refund rate needs enough orders to mean anything', () => {
    expect(score({ sellerOrders30d: 3, refundedOrders30d: 3 })).toBe(0);
    expect(score({ sellerOrders30d: 10, refundedOrders30d: 5 })).toBe(40);
    expect(score({ sellerOrders30d: 10, refundedOrders30d: 2 })).toBe(25);
  });
});

describe('helpers', () => {
  it('recognizes throwaway inboxes', () => {
    expect(isDisposableEmail('someone@Mailinator.com')).toBe(true);
    expect(isDisposableEmail('someone@gmail.com')).toBe(false);
  });

  it('tells public addresses from local ones', () => {
    for (const ip of [
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
      '10.0.3.4',
      '192.168.1.9',
      '172.20.0.1',
      'fd00::1',
      'fe80::1',
      null,
    ]) {
      expect(isPublicIp(ip)).toBe(false);
    }
    for (const ip of ['8.8.8.8', '203.0.113.7', '2001:db8::1', '::ffff:8.8.4.4']) {
      expect(isPublicIp(ip)).toBe(true);
    }
  });
});
