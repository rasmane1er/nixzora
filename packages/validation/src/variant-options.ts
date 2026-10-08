import { OPTION_NAMES } from './taxonomy';

/**
 * Choosing a variant one option at a time (Color, then Size), shared by the website and the app.
 * A product whose variants differ in two or more options and fill most of that grid (clothing:
 * every color in every size) is chosen by option; anything else keeps a simple list of variants.
 */
type Choosable = { options: Record<string, string>; available: number };

export type OptionAxis = { name: string; values: string[] };

const rank = (name: string) => {
  const i = (OPTION_NAMES as readonly string[]).indexOf(name);
  return i === -1 ? OPTION_NAMES.length : i;
};

/** The options to choose, in order, each with its values as first listed; null for a plain list. */
export function optionAxes(variants: readonly Choosable[]): OptionAxis[] | null {
  const values = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.options)) {
      const list = values.get(name) ?? [];
      if (!list.includes(value)) list.push(value);
      values.set(name, list);
    }
  }
  const axes = [...values]
    .filter(([name, list]) => list.length > 1 && variants.every((v) => name in v.options))
    .map(([name, list]) => ({ name, values: list }))
    .sort((a, b) => rank(a.name) - rank(b.name));
  if (axes.length < 2) return null;
  const grid = axes.reduce((n, axis) => n * axis.values.length, 1);
  return variants.length * 2 > grid ? axes : null;
}

/** The variant with `name` set to `value`, keeping as many current choices as possible, in stock first. */
export function pickVariant<V extends Choosable>(
  variants: readonly V[],
  current: V,
  name: string,
  value: string,
): V {
  const candidates = variants.filter((v) => v.options[name] === value);
  const score = (v: V) =>
    Object.entries(current.options).filter(([n, val]) => n !== name && v.options[n] === val)
      .length *
      2 +
    (v.available > 0 ? 1 : 0);
  return candidates.reduce(
    (best, v) => (score(v) > score(best) ? v : best),
    candidates[0] ?? current,
  );
}

/** How a value would look next to the current choices: buyable, sold out, or not made. */
export function optionState(
  variants: readonly Choosable[],
  current: Choosable,
  name: string,
  value: string,
): 'available' | 'soldOut' | 'missing' {
  const match = variants.find(
    (v) =>
      v.options[name] === value &&
      Object.entries(current.options).every(([n, val]) => n === name || v.options[n] === val),
  );
  if (!match) return 'missing';
  return match.available > 0 ? 'available' : 'soldOut';
}
