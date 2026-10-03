import {
  formatters,
  type Locale,
  type MessageKey,
  messagesFor,
  type Translate,
  translator,
} from '@nixzora/i18n';

type ApiErrorKey = MessageKey<'apiErrors'>;

/**
 * English error text → `apiErrors` key. The English catalog holds the exact messages the API
 * throws, so the table is built from it: fixed messages match exactly, and messages with
 * `{name}` parts match as patterns whose parts are carried into the translation.
 */
const english = messagesFor('en').apiErrors as Record<ApiErrorKey, string>;

export const ERROR_MESSAGE_KEYS: ReadonlyMap<string, ApiErrorKey> = new Map(
  (Object.entries(english) as [ApiErrorKey, string][])
    .filter(([, text]) => !text.includes('{'))
    .map(([key, text]) => [text, key]),
);

const PATTERNS: { key: ApiErrorKey; pattern: RegExp }[] = (
  Object.entries(english) as [ApiErrorKey, string][]
)
  .filter(([, text]) => text.includes('{'))
  .map(([key, text]) => ({
    key,
    pattern: new RegExp(
      `^${text
        .split(/(\{\w+\})/)
        .map((part) =>
          /^\{\w+\}$/.test(part)
            ? `(?<${part.slice(1, -1)}>.+?)`
            : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('')}$`,
      's',
    ),
  }));

const translators: Record<Exclude<Locale, 'en'>, Translate<'apiErrors'>> = {
  fr: translator('fr')('apiErrors'),
  es: translator('es')('apiErrors'),
};

/** Parts that are themselves error messages (a coupon problem inside the checkout error). */
const NESTED = new Set(['problem']);
/** US-formatted amounts ("$1,234.50") are re-formatted for the caller's language. */
const USD = /^\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/;

function part(name: string, value: string, locale: Locale): string {
  if (NESTED.has(name)) return translateErrorMessage(value, locale);
  const amount = USD.exec(value);
  if (amount) {
    return formatters(locale).money(Number(amount[1]!.replace(/,/g, '')) * 100 + Number(amount[2]));
  }
  return value;
}

/** The message in the caller's language; unknown messages (and English) come back unchanged. */
export function translateErrorMessage(message: string, locale: Locale): string {
  if (locale === 'en') return message;
  const t = translators[locale];
  const key = ERROR_MESSAGE_KEYS.get(message);
  if (key) return t(key);
  for (const { key, pattern } of PATTERNS) {
    const match = pattern.exec(message);
    if (!match?.groups) continue;
    const vars = Object.fromEntries(
      Object.entries(match.groups).map(([name, value]) => [name, part(name, value, locale)]),
    );
    return t(key, vars);
  }
  return message;
}

/**
 * An HTTP error body with its `message` translated. Everything else (code, issues, cart…) is
 * kept as is; Zod issue messages are left alone on purpose. Returns the same body when nothing
 * changed.
 */
export function translateErrorBody<T>(body: T, locale: Locale): T {
  if (locale === 'en') return body;
  if (typeof body === 'string') return translateErrorMessage(body, locale) as T;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const { message } = body as { message?: unknown };
  let translated: unknown = message;
  if (typeof message === 'string') translated = translateErrorMessage(message, locale);
  else if (Array.isArray(message)) {
    translated = message.map((item: unknown) =>
      typeof item === 'string' ? translateErrorMessage(item, locale) : item,
    );
  }
  if (
    translated === message ||
    (Array.isArray(message) &&
      (translated as unknown[]).every((item, index) => item === message[index]))
  ) {
    return body;
  }
  return { ...body, message: translated };
}
