/**
 * Turns a product into the text that is searched and embedded (ADR-0009).
 *
 * Specs are stored as normalized JSON ({"battery_hours": 18, "anc": true}). Search needs words,
 * so each spec becomes a phrase, and a few well-known thresholds add the words shoppers use
 * ("lightweight", "long battery life"). Both the keyword index and the embedding see them.
 */
export type IndexableProduct = {
  id: string;
  title: string;
  description: string;
  attributes: unknown;
  brand: { name: string } | null;
  category: { name: string; parent: { name: string } | null };
  variants: { title: string; sku: string; options: unknown }[];
};

export type SearchDocument = {
  productId: string;
  titleText: string;
  facetsText: string;
  bodyText: string;
  /** What the embedding model reads: everything, in one paragraph. */
  embeddingText: string;
};

const LABELS: Record<string, string> = {
  anc: 'active noise cancelling',
  ram_gb: 'GB RAM memory',
  storage_gb: 'GB storage SSD',
  battery_hours: 'hours battery life',
  battery_days: 'days battery life',
  battery_mah: 'mAh battery',
  case_battery_hours: 'hours with the charging case',
  cpu_cores: 'core processor',
  screen_in: 'inch screen',
  size_in: 'inch screen',
  weight_kg: 'kg weight',
  weight_g: 'g weight',
  refresh_hz: 'Hz refresh rate',
  usb_c_power_w: 'W USB-C power delivery',
  power_w: 'W power',
  five_g: '5G',
  gps: 'GPS',
  hot_swap: 'hot-swappable switches',
  hall_effect: 'hall effect sticks, no drift',
  local_control: 'local control without the cloud',
  energy_monitoring: 'energy monitoring',
  updates_years: 'years of software updates',
};

export function humanKey(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ');
}

/** "battery_hours: 18" → "18 hours battery life"; "anc: true" → "active noise cancelling". */
export function specPhrases(attributes: unknown): string[] {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return [];
  const phrases: string[] = [];
  for (const [key, value] of Object.entries(attributes as Record<string, unknown>)) {
    if (value === true) phrases.push(humanKey(key));
    else if (typeof value === 'number') phrases.push(`${value} ${humanKey(key)}`);
    else if (typeof value === 'string' && value.trim()) phrases.push(`${humanKey(key)} ${value}`);
  }
  return phrases;
}

/** Shopper words implied by the numbers, e.g. a 0.98 kg laptop is "lightweight". */
export function derivedTraits(attributes: unknown): string[] {
  if (!attributes || typeof attributes !== 'object') return [];
  const a = attributes as Record<string, unknown>;
  const num = (key: string) => (typeof a[key] === 'number' ? (a[key] as number) : undefined);
  const traits: string[] = [];
  const kg = num('weight_kg');
  if (kg !== undefined && kg <= 1.5) traits.push('lightweight portable for travel');
  const hours = num('battery_hours');
  if (hours !== undefined && hours >= 14) traits.push('long battery life all-day');
  const refresh = num('refresh_hz');
  if (refresh !== undefined && refresh >= 120) traits.push('high refresh smooth display');
  const size = num('size_in');
  if (size !== undefined && size >= 27) traits.push('large screen');
  if (a.anc === true) traits.push('noise cancelling quiet for flights and commuting');
  if (a.wireless === true) traits.push('wireless');
  return traits;
}

function optionText(options: unknown): string {
  if (!options || typeof options !== 'object') return '';
  return Object.values(options as Record<string, unknown>)
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}

export function buildSearchDocument(product: IndexableProduct): SearchDocument {
  const brand = product.brand?.name ?? '';
  const categories = [product.category.name, product.category.parent?.name].filter(Boolean);
  const specs = specPhrases(product.attributes);
  const traits = derivedTraits(product.attributes);
  const variants = product.variants.map(
    (variant) => `${variant.title} ${optionText(variant.options)} ${variant.sku}`,
  );

  const titleText = `${product.title} ${brand}`.trim();
  const facetsText = [...categories, ...specs, ...traits, ...variants].join(' · ');
  const bodyText = product.description;
  const embeddingText = [
    `${product.title}${brand ? ` by ${brand}` : ''}.`,
    `Category: ${categories.join(', ')}.`,
    product.description,
    specs.length ? `Specs: ${specs.join('; ')}.` : '',
    traits.length ? `Good for: ${traits.join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { productId: product.id, titleText, facetsText, bodyText, embeddingText };
}
