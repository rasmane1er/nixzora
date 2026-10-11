import { z } from 'zod';

/**
 * Spec chips on product cards (ADR-0053): up to three short facts from a product's attributes,
 * like "30h battery" or "Noise cancelling". Only keys with a chip wording (in @nixzora/i18n)
 * qualify, in this order: what shoppers compare first comes first.
 */
export const CARD_CHIP_KEYS = [
  'anc',
  'wireless',
  'five_g',
  'battery_hours',
  'battery_days',
  'screen_in',
  'size_in',
  'resolution',
  'refresh_hz',
  'cpu_cores',
  'gpu',
  'weight_kg',
  'water_resistance',
  'waterproof',
  'capacity_l',
  'cups',
  'volume_ml',
  'insulated',
  'cold_hours',
  'material',
  'machine_washable',
  'dishwasher_safe',
  'power_w',
  'heat_settings',
  'runtime_min',
  'gps',
  'hot_swap',
  'curved',
  'layout',
  'panel',
  'dpi',
  'form_factor',
  'driver_mm',
  'weight_g',
  'auto_shutoff',
  'length_cm',
  'updates_years',
] as const;
export type CardChipKey = (typeof CARD_CHIP_KEYS)[number];

export const CardChipSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type CardChip = z.infer<typeof CardChipSchema>;

/** Longer text would crowd the card (a long material description, say). */
const MAX_TEXT = 18;

export function cardChips(attributes: unknown, max = 3): CardChip[] {
  if (!attributes || typeof attributes !== 'object') return [];
  const attrs = attributes as Record<string, unknown>;
  const out: CardChip[] = [];
  for (const key of CARD_CHIP_KEYS) {
    const value = attrs[key];
    if (value === true) out.push({ key, value });
    else if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out.push({ key, value });
    } else if (typeof value === 'string' && value.trim() && value.length <= MAX_TEXT) {
      out.push({ key, value: value.trim() });
    }
    if (out.length >= max) break;
  }
  return out;
}
