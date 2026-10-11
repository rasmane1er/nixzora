import { z } from 'zod';

/**
 * Photos per color (p10-29): a photo can belong to one of the product's colors. Choosing that
 * color shows its photos first; cards show the colors as swatches. Shared by the website, the
 * app and the API.
 */
export const COLOR_OPTION = 'color';
/** Swatches a card shows before "+3". */
export const CARD_SWATCHES = 5;

/** The product's colors, in the order its variants list them. */
export function productColors(
  variants: readonly { options: Record<string, string>; isActive?: boolean }[],
): string[] {
  const out: string[] = [];
  for (const variant of variants) {
    if (variant.isActive === false) continue;
    const color = variant.options[COLOR_OPTION];
    if (color && !out.includes(color)) out.push(color);
  }
  return out;
}

/**
 * The photos to show for a color: that color's photos, then the photos of no color in
 * particular. With no color chosen, or a color without photos of its own, every photo.
 */
export function photosForColor<P extends { color?: string | null }>(
  photos: readonly P[],
  color: string | null | undefined,
): P[] {
  if (!color || !photos.some((p) => p.color === color)) return [...photos];
  return [...photos.filter((p) => p.color === color), ...photos.filter((p) => !p.color)];
}

const SWATCHES: Record<string, string> = {
  black: '#1b1b1f',
  white: '#ffffff',
  ivory: '#f6f1e3',
  cream: '#f3ead3',
  natural: '#ece4d2',
  oatmeal: '#ddd3bf',
  oat: '#ddd3bf',
  linen: '#e9e0cf',
  beige: '#d9c7a7',
  sand: '#d6c19c',
  tan: '#c8a77c',
  camel: '#b8864b',
  brown: '#6f4b32',
  chocolate: '#4a2f22',
  walnut: '#5d4030',
  gray: '#8a8f98',
  grey: '#8a8f98',
  heather: '#a3a6ad',
  silver: '#c4c8ce',
  graphite: '#4b4f56',
  charcoal: '#3a3d43',
  slate: '#5c6773',
  navy: '#1f2f4f',
  blue: '#2f5fb3',
  sky: '#8ec3ea',
  denim: '#3d5a80',
  teal: '#2a7f7f',
  green: '#2f7d4f',
  sage: '#9cae93',
  olive: '#6b6f3a',
  forest: '#2c4a33',
  mint: '#b5e3cc',
  red: '#c0392b',
  burgundy: '#6d1f2c',
  wine: '#6d1f2c',
  rust: '#a8502a',
  terracotta: '#c0623f',
  clay: '#b9765a',
  orange: '#e8622c',
  coral: '#ef7c66',
  pink: '#efa3b8',
  rose: '#d98a9a',
  blush: '#f1c9c4',
  purple: '#6b4a9b',
  lavender: '#b9a8d9',
  plum: '#5e3554',
  yellow: '#f2c94c',
  mustard: '#c9a227',
  gold: '#c8a14a',
};

/**
 * A swatch for a color name ("Sage", "Midnight Navy", "Heather Grey"): the last word we know,
 * or null for names we can't draw (the card then shows the name only).
 */
export function colorSwatch(name: string): string | null {
  const words = name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .reverse();
  for (const word of words) if (SWATCHES[word]) return SWATCHES[word]!;
  return null;
}

/** "Navy / Orange", "Walnut & Linen": a two-tone color's two swatches, or null for one tone. */
export function twoToneSwatches(name: string): [string, string] | null {
  const parts = name.split(/\s*(?:\/|&|\+)\s*/).filter(Boolean);
  if (parts.length !== 2) return null;
  const [a, b] = parts.map(colorSwatch);
  return a && b ? [a, b] : null;
}

/** Tags a photo with one of the product's colors, or none (null). */
export const ProductImageColorSchema = z.object({
  color: z.string().trim().min(1).max(60).nullable(),
});
export type ProductImageColor = z.infer<typeof ProductImageColorSchema>;

/** A color on a product card: its swatch, and its main photo when it has one. */
export const CardColorSchema = z.object({
  name: z.string(),
  swatch: z.string().nullable(),
  /** Two-tone colors ("Navy / Orange"): the second half of the swatch. */
  swatch2: z.string().optional(),
  imageUrl: z.string().nullable(),
});
export type CardColor = z.infer<typeof CardColorSchema>;
