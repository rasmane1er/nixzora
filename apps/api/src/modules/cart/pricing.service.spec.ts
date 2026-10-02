import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { PricingService } from './pricing.service';

const values: Partial<Env> = {
  SHIPPING_FLAT_CENTS: 999,
  FREE_SHIPPING_THRESHOLD_CENTS: 9900,
  TAX_RATES_BPS: { MD: 600 },
};
const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
const pricing = new PricingService(config);

describe('PricingService', () => {
  it('charges flat shipping below the threshold and none above it', () => {
    expect(pricing.totals(4900).shippingCents).toBe(999);
    expect(pricing.totals(9900).shippingCents).toBe(0);
    expect(pricing.totals(0)).toMatchObject({ shippingCents: 0, totalCents: 0 });
  });

  it('adds sales tax only where it is configured, rounded to the cent', () => {
    expect(pricing.totals(1999, 'MD').taxCents).toBe(120); // 119.94 → 120
    expect(pricing.totals(1999, 'VA').taxCents).toBe(0);
    expect(pricing.totals(1999).taxCents).toBe(0);
  });

  it('adds it all up', () => {
    expect(pricing.totals(4900, 'MD')).toEqual({
      currency: 'USD',
      subtotalCents: 4900,
      discountCents: 0,
      shippingCents: 999,
      taxCents: 294,
      totalCents: 6193,
      freeShippingRemainingCents: 5000,
    });
  });

  it('applies a discount before shipping and tax', () => {
    // $120 with $30 off: $90 of goods → below free shipping, 6% tax on $90.
    expect(pricing.totals(12000, 'MD', 3000)).toMatchObject({
      discountCents: 3000,
      shippingCents: 999,
      taxCents: 540,
      totalCents: 9000 + 999 + 540,
    });
    expect(pricing.totals(1000, 'MD', 5000).discountCents).toBe(1000);
  });
});
