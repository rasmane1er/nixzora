import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Totals } from '@nixzora/validation';
import { type Env } from '../../config/env';

/**
 * Shipping and tax rules for the launch: one flat shipping rate (free above a threshold) and
 * state sales tax where NIXZORA is registered. Totals are always computed here, on the server.
 */
@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * The discount comes off the merchandise first; free shipping and tax are based on what
   * the customer actually pays for the goods.
   */
  totals(
    subtotalCents: number,
    region?: string | null,
    discountCents = 0,
    currency = 'USD',
    /** NIXZORA Plus (p10-15): shipping is free for members, and NIXZORA's items go 2-day. */
    plus: { member: boolean; twoDay?: boolean } = { member: false },
    /** Bundle & save (p10-16): taken off before the coupon. */
    bundleCents = 0,
    /** Clipped coupons (p10-18): after bundles, before a code. */
    clipCents = 0,
  ): Totals {
    const flat = this.config.get('SHIPPING_FLAT_CENTS', { infer: true });
    const threshold = this.config.get('FREE_SHIPPING_THRESHOLD_CENTS', { infer: true });
    const bundle = Math.min(Math.max(0, bundleCents), subtotalCents);
    const clip = Math.min(Math.max(0, clipCents), subtotalCents - bundle);
    const discount =
      bundle + clip + Math.min(Math.max(0, discountCents), subtotalCents - bundle - clip);
    const goods = subtotalCents - discount;
    const standardCents = subtotalCents === 0 || goods >= threshold ? 0 : flat;
    const shippingCents = plus.member ? 0 : standardCents;
    const rateBps = region ? (this.config.get('TAX_RATES_BPS', { infer: true })[region] ?? 0) : 0;
    // Tax on goods only; round half up to the cent.
    const taxCents = Math.round((goods * rateBps) / 10_000);
    return {
      currency,
      subtotalCents,
      discountCents: discount,
      shippingCents,
      taxCents,
      totalCents: goods + shippingCents + taxCents,
      freeShippingRemainingCents: plus.member
        ? 0
        : subtotalCents === 0
          ? threshold
          : Math.max(0, threshold - goods),
      ...(bundle ? { bundleDiscountCents: bundle } : {}),
      ...(clip ? { clipDiscountCents: clip } : {}),
      ...(plus.member
        ? {
            shippingWaivedCents: standardCents,
            shippingSpeed: plus.twoDay ? ('TWO_DAY' as const) : ('STANDARD' as const),
          }
        : {}),
    };
  }
}
