import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  type Locale,
  type Translate,
  formatters,
  isLocale,
  matchLocale,
  messagesFor,
  translator,
} from '@nixzora/i18n';
import { formatMoney } from '@nixzora/validation';

export type { Locale };

/** The language a model is asked to write in. */
export const LANGUAGE_NAME: Record<Locale, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
};

/** The shopper's language from an Accept-Language header; English when none is supported. */
export function requestLocale(header: string | string[] | undefined): Locale {
  return matchLocale(Array.isArray(header) ? header.join(',') : header);
}

/** A locale from untrusted input (AI service bodies, stored JSON); English otherwise. */
export function localeOr(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

/** Everything the API needs to write a reply in one language. */
export type Replies = {
  locale: Locale;
  t: Translate<'assistantReplies'>;
  /** Spec numbers: "1.4" in English (as written in the catalog), "1,4" in French. */
  num: (value: number | string) => string;
  /** Whole-dollar prices: "$1,149" / "1 149 $US" / "$1,149". */
  money: (cents: number) => string;
  /** "a, b et c" / "a, b y c" (English callers keep their own joins). */
  and: (items: string[]) => string;
  /** A department name in this language when it is a known one, else as stored. */
  department: (category: { slug: string; name: string }) => string;
};

const cache = new Map<Locale, Replies>();

export function repliesFor(locale: Locale = DEFAULT_LOCALE): Replies {
  const cached = cache.get(locale);
  if (cached) return cached;
  const messages = messagesFor(locale);
  const tag = INTL_LOCALE[locale];
  const numbers = new Intl.NumberFormat(tag);
  const list = new Intl.ListFormat(tag, { type: 'conjunction' });
  const departments = messages.departments as Record<string, string>;
  const replies: Replies = {
    locale,
    t: translator(locale, messages)('assistantReplies'),
    num: (value) =>
      locale === 'en' || typeof value !== 'number' ? String(value) : numbers.format(value),
    money: (cents) =>
      locale === 'en'
        ? formatMoney({ amountCents: cents, currency: 'USD' }).replace(/\.00$/, '')
        : formatters(locale)
            .money(cents)
            .replace(/[.,]00(?=\D*$)/, ''),
    and: (items) => list.format(items),
    department: (category) =>
      locale === 'en' ? category.name : (departments[category.slug] ?? category.name),
  };
  cache.set(locale, replies);
  return replies;
}
