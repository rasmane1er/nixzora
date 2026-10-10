'use client';

import { deliveryDay, INTL_LOCALE, rich } from '@nixzora/i18n';
import { type ProductCard } from '@nixzora/validation';
import { useLocale, useT } from './I18nProvider';

/**
 * "50+ bought in past month" and "FREE delivery by …" (p10-17) for cards drawn in the browser
 * (the shopping assistant's picks). The server-drawn ProductCard uses the same rule and also
 * knows whether the shopper has Plus.
 */
export function CardSignals({ product }: { product: ProductCard }) {
  const t = useT('product');
  const locale = useLocale();
  const window = product.inStock ? product.delivery : null;
  const bought =
    product.boughtPastMonth != null
      ? new Intl.NumberFormat(INTL_LOCALE[locale], { notation: 'compact' }).format(
          product.boughtPastMonth,
        )
      : null;
  let delivery: ReturnType<typeof rich<React.ReactNode>> | null = null;
  if (window) {
    const day = deliveryDay(window.latest, locale);
    const when = day.tomorrow
      ? t('deliveryTomorrow', { date: day.text })
      : window.earliest === window.latest
        ? day.text
        : t('deliveryBy', { date: day.text });
    delivery = rich<React.ReactNode>(
      t(product.freeDelivery ? 'deliveryFree' : 'deliveryPaid', { date: `<b>${when}</b>` }),
      { b: (chunk) => <strong key="when">{chunk}</strong> },
    );
  }
  return (
    <>
      {bought ? (
        <span className="card-bought">{t('boughtPastMonth', { count: bought })}</span>
      ) : null}
      {delivery ? <span className="card-delivery">{delivery}</span> : null}
    </>
  );
}
