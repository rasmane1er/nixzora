/**
 * The catalog's shape, in one place: departments and how they nest, the artwork for each
 * department tile, which departments a seller can choose, the product spec keys we know, and the
 * variant option names. The seed, the API, the website, the app and the seller forms all read
 * from here; nothing else keeps its own copy.
 *
 * Words people read (department names, spec labels, option names in English, French and Spanish)
 * live in @nixzora/i18n, keyed by the slugs and keys below. A test in the API checks that every
 * slug and key here has its translations.
 */

type Department = {
  /** URL slug and translation key, e.g. "laptops" → /c/laptops and departments.laptops. */
  readonly slug: string;
  readonly parent: string | null;
  /** Order among its siblings. */
  readonly position: number;
  /** Demo product whose picture stands for the department on the home pages. */
  readonly art?: string;
  /** Offered as "what do you mainly sell?" on the seller application. */
  readonly seller?: boolean;
  /** Only a seller choice: no category page of its own. */
  readonly sellerOnly?: boolean;
};

export const DEPARTMENTS = [
  // Electronics
  { slug: 'electronics', parent: null, position: 1, art: 'vela-15-studio' },
  { slug: 'computers', parent: 'electronics', position: 1, art: 'vela-15-studio', seller: true },
  { slug: 'laptops', parent: 'computers', position: 1, art: 'vela-13-air' },
  { slug: 'desktops', parent: 'computers', position: 2, art: 'kestrel-tower-x' },
  { slug: 'monitors', parent: 'electronics', position: 2, art: 'arden-27-4k-usb-c', seller: true },
  { slug: 'audio', parent: 'electronics', position: 3, art: 'halo-anc-headphones', seller: true },
  { slug: 'headphones', parent: 'audio', position: 1, art: 'halo-anc-headphones' },
  { slug: 'speakers', parent: 'audio', position: 2, art: 'lumen-desk-speakers' },
  { slug: 'phones', parent: 'electronics', position: 4, art: 'orbit-phone-256', seller: true },
  { slug: 'smart-home', parent: 'electronics', position: 5, art: 'nimbus-smart-hub', seller: true },
  { slug: 'gaming', parent: 'electronics', position: 6, art: 'pulse-controller', seller: true },
  { slug: 'accessories', parent: 'electronics', position: 7, art: 'tactile-75', seller: true },
  { slug: 'keyboards', parent: 'accessories', position: 1, art: 'tactile-75' },
  { slug: 'mice', parent: 'accessories', position: 2, art: 'tactile-precision-mouse' },
  { slug: 'wearables', parent: 'electronics', position: 8, art: 'pulse-s-watch', seller: true },
  { slug: 'other-electronics', parent: 'electronics', position: 9, seller: true, sellerOnly: true },
  // Clothing & shoes
  { slug: 'clothing-shoes', parent: null, position: 2, art: 'linden-fleece-hoodie', seller: true },
  { slug: 'tops', parent: 'clothing-shoes', position: 1, art: 'linden-organic-tee' },
  { slug: 'outerwear', parent: 'clothing-shoes', position: 2, art: 'alder-rain-jacket' },
  { slug: 'shoes', parent: 'clothing-shoes', position: 3, art: 'stride-runner' },
  // Home & kitchen
  { slug: 'home-kitchen', parent: null, position: 3, art: 'hearth-electric-kettle', seller: true },
  { slug: 'kitchen', parent: 'home-kitchen', position: 1, art: 'ferro-cast-iron-skillet' },
  { slug: 'home-living', parent: 'home-kitchen', position: 2, art: 'haven-throw-blanket' },
  // Beauty & personal care
  { slug: 'beauty', parent: null, position: 4, art: 'dewdrop-hydrating-serum', seller: true },
  { slug: 'skincare', parent: 'beauty', position: 1, art: 'dewdrop-hydrating-serum' },
  { slug: 'hair-care', parent: 'beauty', position: 2, art: 'aero-ionic-hair-dryer' },
  { slug: 'grooming', parent: 'beauty', position: 3, art: 'edgeline-beard-trimmer' },
  // Sports & outdoors
  { slug: 'sports-outdoors', parent: null, position: 5, art: 'core-yoga-mat', seller: true },
  { slug: 'fitness', parent: 'sports-outdoors', position: 1, art: 'core-adjustable-dumbbells' },
  { slug: 'outdoor', parent: 'sports-outdoors', position: 2, art: 'trailhead-28-backpack' },
] as const satisfies readonly Department[];

export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];

/** Departments that are real categories (everything but seller-only choices), parents first. */
export const CATEGORY_DEPARTMENTS: readonly Department[] = DEPARTMENTS.filter(
  (d: Department) => !d.sellerOnly,
);

/** "/demo-products/vela-15-studio.webp" for a department slug (served by the storefront). */
export function departmentArtPath(slug: string): string | null {
  const department = (DEPARTMENTS as readonly Department[]).find((d) => d.slug === slug);
  return department?.art ? `/demo-products/${department.art}.webp` : null;
}

/** What a seller mainly sells: the departments marked `seller` above, in the same order. */
export type SellerCategory = Extract<(typeof DEPARTMENTS)[number], { seller: true }>['slug'];
export const SELLER_CATEGORIES = DEPARTMENTS.filter((d: Department) => d.seller).map(
  (d) => d.slug,
) as unknown as readonly [SellerCategory, ...SellerCategory[]];

/**
 * Product spec keys we know, with the words shoppers use for them (indexed for search and read by
 * the assistant). Values are numbers, true/false or short text; a unit suffix in the key
 * (`_kg`, `_hours`, `_ml`) is shown next to the label. Labels are productPage.spec_<key>.
 */
export const SPECS = {
  // Electronics
  screen_in: 'inch screen',
  size_in: 'inch display',
  resolution: 'resolution',
  refresh_hz: 'Hz refresh rate',
  cpu_cores: 'core processor',
  ram_gb: 'GB RAM memory',
  storage_gb: 'GB storage SSD',
  battery_hours: 'hours battery life',
  case_battery_hours: 'hours with the charging case',
  battery_days: 'days battery life',
  battery_mah: 'mAh battery',
  os: 'operating system',
  form_factor: 'form factor',
  wifi: 'Wi-Fi',
  usb_c_power_w: 'W USB-C power delivery',
  panel: 'panel',
  curved: 'curved',
  anc: 'active noise cancelling',
  bluetooth: 'Bluetooth',
  water_resistance: 'water resistance',
  inputs: 'inputs',
  updates_years: 'years of software updates',
  five_g: '5G',
  protocols: 'protocols',
  local_control: 'local control without the cloud',
  energy_monitoring: 'energy monitoring',
  hall_effect: 'hall effect sticks, no drift',
  platforms: 'platforms',
  layout: 'layout',
  hot_swap: 'hot-swappable switches',
  wireless: 'wireless',
  tenting: 'tenting',
  dpi: 'DPI',
  devices: 'devices',
  gps: 'GPS',
  woofer_in: 'inch woofer',
  impedance_ohm: 'ohm impedance',
  driver_mm: 'mm drivers',
  // Shared
  weight_kg: 'kg weight',
  weight_g: 'g weight',
  power_w: 'W power',
  material: 'material',
  waterproof: 'waterproof',
  // Clothing & shoes
  fit: 'fit',
  care: 'care',
  breathable: 'breathable',
  cushioning: 'cushioning',
  // Home & kitchen
  capacity_l: 'litre capacity',
  cups: 'cups',
  diameter_cm: 'cm diameter',
  dishwasher_safe: 'dishwasher safe',
  oven_safe: 'oven safe',
  auto_shutoff: 'automatic shut-off',
  machine_washable: 'machine washable',
  // Beauty & personal care
  volume_ml: 'ml',
  skin_type: 'skin type',
  key_ingredients: 'key ingredients',
  spf: 'SPF sun protection',
  fragrance_free: 'fragrance free',
  heat_settings: 'heat settings',
  runtime_min: 'minutes runtime',
  lengths: 'length settings',
  // Sports & outdoors
  thickness_mm: 'mm thick',
  length_cm: 'cm long',
  max_weight_kg: 'kg maximum weight',
  insulated: 'insulated',
  cold_hours: 'hours cold',
} as const;

export type SpecKey = keyof typeof SPECS;

/** "battery_hours" → "hours battery life"; unknown keys are spelled out. */
export function specSearchWords(key: string): string {
  return (SPECS as Record<string, string>)[key] ?? key.replace(/_/g, ' ');
}

/**
 * Variant option names, in the order a product page asks for them (Color, then Size). Labels are
 * productPage.option_<name>.
 */
export const OPTION_NAMES = ['color', 'size', 'memory', 'storage', 'pack', 'switches'] as const;
export type OptionName = (typeof OPTION_NAMES)[number];

/**
 * What goes with what, by category: someone who bought (or is about to buy) a laptop may want a
 * mouse, a keyboard or headphones. Used for "Goes with your cart" and "For your <product>"
 * picks; the first categories listed come first.
 */
export const COMPLEMENTS: Readonly<Partial<Record<DepartmentSlug, readonly DepartmentSlug[]>>> = {
  laptops: ['mice', 'keyboards', 'monitors', 'headphones'],
  desktops: ['monitors', 'keyboards', 'mice', 'speakers'],
  monitors: ['keyboards', 'mice', 'speakers'],
  keyboards: ['mice', 'monitors'],
  mice: ['keyboards'],
  phones: ['headphones', 'wearables', 'speakers'],
  headphones: ['phones', 'speakers'],
  speakers: ['smart-home', 'headphones'],
  'smart-home': ['speakers'],
  gaming: ['headphones', 'monitors'],
  wearables: ['phones', 'headphones', 'fitness'],
  tops: ['outerwear', 'shoes'],
  outerwear: ['tops', 'outdoor', 'shoes'],
  shoes: ['tops', 'fitness'],
  kitchen: ['home-living'],
  'home-living': ['kitchen'],
  skincare: ['hair-care', 'grooming'],
  'hair-care': ['skincare'],
  grooming: ['skincare'],
  fitness: ['shoes', 'wearables', 'outdoor'],
  outdoor: ['outerwear', 'fitness'],
};

/**
 * Categories of things that run out, with the usual days between purchases. "Time to restock"
 * suggests an item once most of that time has passed since it was last ordered. Durable goods
 * (a hair dryer, a skillet) are never listed here.
 */
export const REPLENISH_DAYS: Readonly<Partial<Record<DepartmentSlug, number>>> = {
  skincare: 45,
};
