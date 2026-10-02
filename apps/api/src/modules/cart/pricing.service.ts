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
  ): Totals {
    const flat = this.config.get('SHIPPING_FLAT_CENTS', { infer: true });
    const threshold = this.config.get('FREE_SHIPPING_THRESHOLD_CENTS', { infer: true });
    const discount = Math.min(Math.max(0, discountCents), subtotalCents);
    const goods = subtotalCents - discount;
    const shippingCents = subtotalCents === 0 || goods >= threshold ? 0 : flat;
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
      freeShippingRemainingCents: subtotalCents === 0 ? threshold : Math.max(0, threshold - goods),
    };
  }
}
