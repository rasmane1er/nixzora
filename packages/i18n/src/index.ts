import * as catalogs from './messages';
import { type Locale } from './locale';
import { format, type Vars } from './translate';

export * from './locale';
export { formatters, type Formatters } from './formatters';
export { format, rich, type Vars } from './translate';
export { defineMessages, type Catalog } from './define';
export { filterValueLabel, optionLabel, specLabel } from './catalog-labels';
export { smartRowTitle } from './smart-rows';
export { deliveryDay, deliveryRange } from './delivery-format';
export { cardBrand } from './messages/wallet';

export type Namespace = keyof typeof catalogs;
/** Every namespace's messages for one language. */
export type Messages = { [N in Namespace]: Record<keyof (typeof catalogs)[N]['en'], string> };
export type MessageKey<N extends Namespace> = keyof Messages[N] & string;

export function messagesFor(locale: Locale): Messages {
  const out = {} as Record<string, Record<string, string>>;
  for (const [name, catalog] of Object.entries(catalogs)) {
    out[name] = catalog[locale] as Record<string, string>;
  }
  return out as Messages;
}

export type Translate<N extends Namespace> = (key: MessageKey<N>, vars?: Vars) => string;

/** `const t = translator('fr', messages)('cart'); t('title')` */
export function translator(locale: Locale, messages: Messages = messagesFor(locale)) {
  return <N extends Namespace>(namespace: N): Translate<N> =>
    (key, vars) =>
      format(locale, (messages[namespace] as Record<string, string>)[key] ?? String(key), vars);
}
export { dateFormat, numberFormat, plurals } from './intl';

/** Buy X, get Y terms (p10-27) in the reader's language: "Buy 2, get 1 free". */
export function multiBuyTerms(
  t: Translate<'multiBuy'>,
  terms: { buyQty: number; getQty: number; percentOff: number },
): string {
  const vars = { buy: terms.buyQty, get: terms.getQty, percent: terms.percentOff };
  return terms.percentOff >= 100 ? t('terms_free', vars) : t('terms_percent', vars);
}

/** "Add 1 more item from this offer and it's free" (p10-27). */
export function multiBuyAddMore(
  t: Translate<'multiBuy'>,
  offer: { addMore: number; percentOff: number },
): string {
  const vars = { count: offer.addMore, percent: offer.percentOff };
  return offer.percentOff >= 100 ? t('addMore_free', vars) : t('addMore_percent', vars);
}
