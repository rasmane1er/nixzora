import { numberFormat, plurals } from './intl';
import { INTL_LOCALE, type Locale } from './locale';

export type Vars = Record<string, string | number>;

const PLURAL = /\{(\w+), plural, ((?:[=\w]+ \{[^{}]*\}\s*)+)\}/g;
const OPTION = /([=\w]+) \{([^{}]*)\}/g;
const VAR = /\{(\w+)\}/g;

/**
 * Fills a message: `{name}` placeholders and ICU-style plurals,
 * e.g. "{count, plural, =0 {No items} one {# item} other {# items}}".
 */
export function format(locale: Locale, message: string, vars: Vars = {}): string {
  const tag = INTL_LOCALE[locale];
  const withPlurals = message.replace(PLURAL, (_, name: string, options: string) => {
    const n = Number(vars[name] ?? 0);
    const choices = new Map<string, string>();
    for (const [, key, text] of options.matchAll(OPTION)) choices.set(key!, text!);
    const chosen =
      choices.get(`=${n}`) ?? choices.get(plurals(tag).select(n)) ?? choices.get('other') ?? '';
    return chosen.replace(/#/g, numberFormat(tag).format(n));
  });
  return withPlurals.replace(VAR, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * Splits a message with tags ("Read the <link>policy</link>") into text and rendered parts, so
 * apps can put links or bold text inside a translated sentence.
 */
export function rich<N>(
  message: string,
  tags: Record<string, (chunk: string) => N>,
): (string | N)[] {
  const parts: (string | N)[] = [];
  const pattern = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  for (const match of message.matchAll(pattern)) {
    const [whole, name, chunk] = match;
    if (match.index! > last) parts.push(message.slice(last, match.index));
    const render = tags[name!];
    parts.push(render ? render(chunk!) : chunk!);
    last = match.index! + whole.length;
  }
  if (last < message.length) parts.push(message.slice(last));
  return parts;
}
