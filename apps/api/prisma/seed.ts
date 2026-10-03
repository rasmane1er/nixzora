/**
 * Demo catalog for the launch vertical: computers and electronics.
 * Every brand and product here is fictional sample data for development and demos.
 * Safe to run repeatedly: rows are matched by slug and SKU and updated in place.
 *
 * Run: pnpm --filter @nixzora/api db:seed
 */
import 'dotenv/config';
import { withConnectionUrls } from '../src/config/connection-urls';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: withConnectionUrls(process.env).DATABASE_URL as string,
  }),
});

type CategorySeed = {
  slug: string;
  name: string;
  parent?: string;
  position: number;
  description?: string;
};
/**
 * A stable, fake EAN-13 for each demo SKU, in the GS1 "restricted circulation" range (200–299),
 * which is never assigned to real products. Lets you try the app's barcode scanner on the demo.
 */
function demoBarcode(sku: string): string {
  let hash = 0;
  for (const char of sku) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_000;
  const body = `200${String(hash).padStart(9, '0')}`;
  const sum = [...body].reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

type VariantSeed = {
  sku: string;
  title: string;
  options: Record<string, string>;
  price: number;
  was?: number;
  stock: number;
};
type ProductSeed = {
  slug: string;
  title: string;
  brand: string;
  category: string;
  description: string;
  attributes: Record<string, string | number | boolean>;
  variants: VariantSeed[];
  /** Handle of the marketplace seller; first-party (NIXZORA) when absent. */
  seller?: string;
};

const categories: CategorySeed[] = [
  {
    slug: 'computers',
    name: 'Computers',
    position: 1,
    description: 'Laptops, desktops and everything to build a workstation.',
  },
  { slug: 'laptops', name: 'Laptops', parent: 'computers', position: 1 },
  { slug: 'desktops', name: 'Desktops', parent: 'computers', position: 2 },
  { slug: 'monitors', name: 'Monitors', position: 2 },
  { slug: 'audio', name: 'Audio', position: 3 },
  { slug: 'headphones', name: 'Headphones', parent: 'audio', position: 1 },
  { slug: 'speakers', name: 'Speakers', parent: 'audio', position: 2 },
  { slug: 'phones', name: 'Phones', position: 4 },
  { slug: 'smart-home', name: 'Smart home', position: 5 },
  { slug: 'gaming', name: 'Gaming', position: 6 },
  { slug: 'accessories', name: 'Accessories', position: 7 },
  { slug: 'keyboards', name: 'Keyboards', parent: 'accessories', position: 1 },
  { slug: 'mice', name: 'Mice', parent: 'accessories', position: 2 },
  { slug: 'wearables', name: 'Wearables', position: 8 },
];

const brands = [
  'Kestrel',
  'Arden',
  'Vela',
  'Halo',
  'Drift',
  'Tactile',
  'Pulse',
  'Orbit',
  'Nimbus',
  'Lumen',
  'Brightline',
];

const laptop = (
  slug: string,
  title: string,
  brand: string,
  description: string,
  base: Record<string, string | number | boolean>,
  variants: VariantSeed[],
): ProductSeed => ({
  slug,
  title,
  brand,
  category: 'laptops',
  description,
  attributes: base,
  variants,
});

const products: ProductSeed[] = [
  laptop(
    'kestrel-14-pro',
    'Kestrel 14 Pro developer laptop',
    'Kestrel',
    'A 1.4 kg, 14-inch laptop built for coding on the road: 12-core processor, 3K 120 Hz display, up to 18 hours of battery and a quiet cooling system that stays silent under compile loads.',
    {
      screen_in: 14,
      resolution: '3K',
      refresh_hz: 120,
      cpu_cores: 12,
      battery_hours: 18,
      weight_kg: 1.4,
      os: 'Windows or Linux',
    },
    [
      {
        sku: 'KES14P-16-512-GR',
        title: '16GB / 512GB / Graphite',
        options: { memory: '16GB', storage: '512GB', color: 'Graphite' },
        price: 114900,
        stock: 18,
      },
      {
        sku: 'KES14P-32-1T-GR',
        title: '32GB / 1TB / Graphite',
        options: { memory: '32GB', storage: '1TB', color: 'Graphite' },
        price: 134900,
        was: 149900,
        stock: 6,
      },
      {
        sku: 'KES14P-32-1T-SV',
        title: '32GB / 1TB / Silver',
        options: { memory: '32GB', storage: '1TB', color: 'Silver' },
        price: 134900,
        was: 149900,
        stock: 11,
      },
      {
        sku: 'KES14P-64-2T-GR',
        title: '64GB / 2TB / Graphite',
        options: { memory: '64GB', storage: '2TB', color: 'Graphite' },
        price: 164900,
        stock: 3,
      },
    ],
  ),
  laptop(
    'arden-16',
    'Arden 16 performance laptop',
    'Arden',
    'A 16-inch powerhouse with a 165 Hz 2.5K display and a discrete GPU for builds, data work and evening games.',
    {
      screen_in: 16,
      resolution: '2.5K',
      refresh_hz: 165,
      cpu_cores: 16,
      battery_hours: 11,
      weight_kg: 2.1,
      gpu: 'Discrete 8GB',
    },
    [
      {
        sku: 'ARD16-32-1T',
        title: '32GB / 1TB',
        options: { memory: '32GB', storage: '1TB' },
        price: 142900,
        stock: 9,
      },
      {
        sku: 'ARD16-64-2T',
        title: '64GB / 2TB',
        options: { memory: '64GB', storage: '2TB' },
        price: 179900,
        stock: 4,
      },
    ],
  ),
  laptop(
    'vela-15-studio',
    'Vela 15 Studio OLED laptop',
    'Vela',
    'A color-accurate 15-inch OLED laptop for designers and developers who care about the screen.',
    {
      screen_in: 15,
      resolution: '3.5K OLED',
      refresh_hz: 60,
      cpu_cores: 10,
      battery_hours: 14,
      weight_kg: 1.7,
    },
    [
      {
        sku: 'VEL15S-32-512',
        title: '32GB / 512GB',
        options: { memory: '32GB', storage: '512GB' },
        price: 119900,
        stock: 7,
      },
      {
        sku: 'VEL15S-16-512',
        title: '16GB / 512GB',
        options: { memory: '16GB', storage: '512GB' },
        price: 99900,
        was: 109900,
        stock: 12,
      },
    ],
  ),
  laptop(
    'vela-13-air',
    'Vela 13 Air ultralight laptop',
    'Vela',
    'Under a kilogram, fanless and silent. For notes, email and light development.',
    {
      screen_in: 13,
      resolution: '2K',
      refresh_hz: 60,
      cpu_cores: 8,
      battery_hours: 16,
      weight_kg: 0.98,
    },
    [
      {
        sku: 'VEL13A-16-256',
        title: '16GB / 256GB',
        options: { memory: '16GB', storage: '256GB' },
        price: 89900,
        was: 109900,
        stock: 22,
      },
    ],
  ),
  {
    slug: 'kestrel-tower-x',
    title: 'Kestrel Tower X desktop workstation',
    brand: 'Kestrel',
    category: 'desktops',
    description:
      'A quiet mid-tower workstation with room to grow: 24 cores, fast NVMe storage and tool-free upgrades.',
    attributes: { cpu_cores: 24, form_factor: 'Mid tower', wifi: '7' },
    variants: [
      {
        sku: 'KESTX-64-2T',
        title: '64GB / 2TB',
        options: { memory: '64GB', storage: '2TB' },
        price: 249900,
        stock: 5,
      },
      {
        sku: 'KESTX-128-4T',
        title: '128GB / 4TB',
        options: { memory: '128GB', storage: '4TB' },
        price: 329900,
        stock: 2,
      },
    ],
  },
  {
    slug: 'arden-27-4k-usb-c',
    title: 'Arden 27" 4K USB-C monitor',
    brand: 'Arden',
    category: 'monitors',
    description:
      'One cable for picture, power (90 W) and USB hub. Factory calibrated, height adjustable.',
    attributes: { size_in: 27, resolution: '4K', refresh_hz: 60, usb_c_power_w: 90, panel: 'IPS' },
    variants: [
      { sku: 'ARD27-4K', title: '27-inch', options: { size: '27"' }, price: 38900, stock: 14 },
    ],
  },
  {
    slug: 'arden-34-ultrawide',
    title: 'Arden 34" curved ultrawide monitor',
    brand: 'Arden',
    category: 'monitors',
    description:
      'Two monitors’ worth of space without the bezel in the middle. 144 Hz for smooth scrolling and games.',
    attributes: {
      size_in: 34,
      resolution: '3440x1440',
      refresh_hz: 144,
      panel: 'VA',
      curved: true,
    },
    variants: [
      {
        sku: 'ARD34-UW',
        title: '34-inch',
        options: { size: '34"' },
        price: 54900,
        was: 62900,
        stock: 5,
      },
    ],
  },
  {
    slug: 'lumen-24-everyday',
    title: 'Lumen 24" everyday monitor',
    brand: 'Lumen',
    category: 'monitors',
    description: 'A sharp, eye-friendly second screen at a friendly price.',
    attributes: { size_in: 24, resolution: '1080p', refresh_hz: 100, panel: 'IPS' },
    variants: [
      { sku: 'LUM24-FHD', title: '24-inch', options: { size: '24"' }, price: 14900, stock: 40 },
    ],
  },
  {
    slug: 'halo-anc-headphones',
    title: 'Halo ANC wireless headphones',
    brand: 'Halo',
    category: 'headphones',
    description:
      'Adaptive noise cancelling, 30-hour battery and soft memory-foam cushions that stay comfortable with glasses.',
    attributes: { battery_hours: 30, anc: true, weight_g: 250, bluetooth: '5.4' },
    variants: [
      { sku: 'HALO-ANC-BK', title: 'Black', options: { color: 'Black' }, price: 22900, stock: 31 },
      { sku: 'HALO-ANC-SD', title: 'Sand', options: { color: 'Sand' }, price: 22900, stock: 8 },
    ],
  },
  {
    slug: 'drift-over-ear',
    title: 'Drift over-ear headphones',
    brand: 'Drift',
    category: 'headphones',
    description: 'Big sound and a 40-hour battery for long flights.',
    attributes: { battery_hours: 40, anc: true, weight_g: 290 },
    variants: [
      { sku: 'DRIFT-OE-BK', title: 'Black', options: { color: 'Black' }, price: 19900, stock: 17 },
    ],
  },
  {
    slug: 'drift-earbuds',
    title: 'Drift true wireless earbuds',
    brand: 'Drift',
    category: 'headphones',
    description: 'Pocketable earbuds with noise cancelling and wireless charging.',
    attributes: { battery_hours: 8, case_battery_hours: 30, anc: true, water_resistance: 'IPX4' },
    variants: [
      {
        sku: 'DRIFT-EB-WH',
        title: 'White',
        options: { color: 'White' },
        price: 8900,
        was: 11900,
        stock: 55,
      },
    ],
  },
  {
    slug: 'lumen-desk-speakers',
    title: 'Lumen desktop speakers',
    brand: 'Lumen',
    category: 'speakers',
    description: 'Compact powered speakers that fill a room, with USB-C audio and Bluetooth.',
    attributes: { power_w: 60, inputs: 'USB-C, Bluetooth, 3.5mm' },
    variants: [
      { sku: 'LUM-SPK-2', title: 'Pair', options: { color: 'Walnut' }, price: 14900, stock: 12 },
    ],
  },
  {
    slug: 'orbit-phone-256',
    title: 'Orbit smartphone',
    brand: 'Orbit',
    category: 'phones',
    description: 'A 6.3-inch phone with a three-day battery and seven years of updates.',
    attributes: { screen_in: 6.3, battery_mah: 5000, updates_years: 7, five_g: true },
    variants: [
      {
        sku: 'ORB-128-BK',
        title: '128GB / Black',
        options: { storage: '128GB', color: 'Black' },
        price: 59900,
        stock: 20,
      },
      {
        sku: 'ORB-256-BK',
        title: '256GB / Black',
        options: { storage: '256GB', color: 'Black' },
        price: 69900,
        was: 79900,
        stock: 13,
      },
      {
        sku: 'ORB-256-SG',
        title: '256GB / Sage',
        options: { storage: '256GB', color: 'Sage' },
        price: 69900,
        was: 79900,
        stock: 0,
      },
    ],
  },
  {
    slug: 'nimbus-smart-hub',
    title: 'Nimbus smart home hub',
    brand: 'Nimbus',
    category: 'smart-home',
    description:
      'Connects lights, locks and sensors from different makers in one private, local-first app.',
    attributes: { protocols: 'Matter, Thread, Zigbee', local_control: true },
    variants: [{ sku: 'NIM-HUB-2', title: 'Hub', options: {}, price: 5900, was: 8400, stock: 26 }],
  },
  {
    slug: 'nimbus-smart-plug-4',
    title: 'Nimbus smart plug (4-pack)',
    brand: 'Nimbus',
    category: 'smart-home',
    description: 'Schedule lamps and appliances and see their energy use.',
    attributes: { protocols: 'Matter', energy_monitoring: true },
    variants: [
      { sku: 'NIM-PLUG-4', title: '4-pack', options: { pack: '4' }, price: 3900, stock: 48 },
    ],
  },
  {
    slug: 'pulse-controller',
    title: 'Pulse wireless game controller',
    brand: 'Pulse',
    category: 'gaming',
    description:
      'Hall-effect sticks that do not drift, swappable back paddles and 40-hour battery.',
    attributes: { battery_hours: 40, hall_effect: true, platforms: 'PC, mobile' },
    variants: [
      { sku: 'PLS-CTRL-BK', title: 'Black', options: { color: 'Black' }, price: 6900, stock: 2 },
    ],
  },
  {
    slug: 'tactile-75',
    title: 'Tactile 75 mechanical keyboard',
    brand: 'Tactile',
    category: 'keyboards',
    description:
      'A 75% aluminum keyboard with hot-swap switches, gasket mount and Mac and Windows layouts.',
    attributes: { layout: '75%', hot_swap: true, wireless: true, battery_hours: 200 },
    variants: [
      {
        sku: 'TAC75-BRN',
        title: 'Brown switches',
        options: { switches: 'Brown (tactile)' },
        price: 11900,
        stock: 16,
      },
      {
        sku: 'TAC75-RED',
        title: 'Red switches',
        options: { switches: 'Red (linear)' },
        price: 11900,
        stock: 9,
      },
    ],
  },
  {
    slug: 'tactile-ergo-split',
    title: 'Tactile Ergo split keyboard',
    brand: 'Tactile',
    category: 'keyboards',
    description: 'A split, tented keyboard for long coding days and happier wrists.',
    attributes: { layout: 'Split', tenting: true, wireless: true },
    variants: [{ sku: 'TAC-ERGO', title: 'Standard', options: {}, price: 21900, stock: 4 }],
  },
  {
    slug: 'tactile-precision-mouse',
    title: 'Tactile Precision mouse',
    brand: 'Tactile',
    category: 'mice',
    description: 'An ergonomic mouse with a fast, silent scroll wheel and three-device switching.',
    attributes: { dpi: 8000, devices: 3, battery_days: 70 },
    variants: [
      {
        sku: 'TAC-MSE-GR',
        title: 'Graphite',
        options: { color: 'Graphite' },
        price: 7900,
        stock: 33,
      },
    ],
  },
  {
    slug: 'pulse-s-watch',
    title: 'Pulse S smartwatch',
    brand: 'Pulse',
    category: 'wearables',
    description: 'GPS, heart-rate and sleep tracking with a week of battery.',
    attributes: { gps: true, battery_days: 7, water_resistance: '5 ATM' },
    variants: [
      {
        sku: 'PLS-S-41',
        title: '41 mm',
        options: { size: '41 mm' },
        price: 19900,
        was: 24900,
        stock: 10,
      },
      {
        sku: 'PLS-S-45',
        title: '45 mm',
        options: { size: '45 mm' },
        price: 21900,
        was: 26900,
        stock: 7,
      },
    ],
  },
  // Sold by the demo marketplace seller "Brightline Audio" (Phase 7).
  {
    slug: 'brightline-bookshelf-speakers',
    title: 'Brightline bookshelf speakers',
    brand: 'Brightline',
    category: 'speakers',
    seller: 'brightline-audio',
    description:
      'Passive two-way bookshelf speakers with a 5.25-inch woofer and a silk-dome tweeter, in a walnut-edged cabinet.',
    attributes: { power_w: 80, woofer_in: 5.25, impedance_ohm: 6, inputs: 'Binding posts' },
    variants: [
      {
        sku: 'BRL-BSS-WAL',
        title: 'Pair',
        options: { color: 'Walnut / Linen' },
        price: 32900,
        stock: 7,
      },
    ],
  },
  {
    slug: 'brightline-studio-headphones',
    title: 'Brightline studio headphones',
    brand: 'Brightline',
    category: 'headphones',
    seller: 'brightline-audio',
    description:
      'Closed-back wired headphones for mixing and long listening sessions, with a detachable cable.',
    attributes: { wireless: false, driver_mm: 45, impedance_ohm: 38, weight_g: 290 },
    variants: [
      { sku: 'BRL-STU-RED', title: 'Red', options: { color: 'Red' }, price: 15900, stock: 15 },
    ],
  },
];

// Demo reviews so the product pages and "what customers say" have something to show. The
// authors are demo accounts that cannot sign in, and their names say "(demo)".
const DEMO_REVIEWS: Record<string, [number, string, string][]> = {
  'kestrel-14-pro': [
    [
      5,
      'Silent while compiling',
      'The fan stays quiet even during long builds. Battery easily lasts a full workday and the screen is sharp.',
    ],
    [
      5,
      'Great travel laptop',
      'Lightweight enough for my backpack every day. The keyboard is comfortable for long typing sessions.',
    ],
    [
      4,
      'Fast and quiet',
      'Performance is excellent for Docker and IDEs. The display is bright, but the speakers are a bit thin.',
    ],
    [
      4,
      'Solid build',
      'Feels premium and sturdy. Battery is great, though the charger is bulky to carry.',
    ],
    [
      3,
      'Good, not perfect',
      'Runs fast and the screen is great, but only two USB-C ports is annoying for my setup.',
    ],
  ],
  'halo-anc-headphones': [
    [
      5,
      'Perfect for flights',
      'Noise cancelling is excellent on planes and they stay comfortable for hours. Battery lasts the whole trip.',
    ],
    [5, 'Comfortable all day', 'Very comfortable even with glasses. Sound is warm and detailed.'],
    [4, 'Great sound', 'The sound is great but the app setup took a few tries to pair.'],
    [4, 'Quiet commute', 'ANC is impressive on the train. The case is a bit bulky.'],
    [
      2,
      'Connection drops',
      'Bluetooth connection keeps dropping with my laptop, which is annoying. Comfortable though.',
    ],
  ],
  'pulse-s-watch': [
    [
      5,
      'A week of battery',
      'Battery really lasts about a week with GPS runs twice a week. Comfortable to sleep in.',
    ],
    [
      4,
      'Good running watch',
      'GPS locks quickly and heart rate looks accurate. The app is easy to use.',
    ],
    [4, 'Light and comfortable', 'Comfortable on the wrist and the screen is bright outdoors.'],
    [3, 'Okay value', 'Does the basics well, but the strap feels cheap for the price.'],
  ],
  'tactile-75': [
    [
      5,
      'Lovely to type on',
      'Typing feels fantastic and the switches are smooth. Solid build with no flex.',
    ],
    [
      5,
      'Great keyboard',
      'Build quality is excellent and the Bluetooth connection is stable across three devices.',
    ],
    [4, 'Nice but loud', 'Keys feel great, but it is loud on video calls.'],
    [4, 'Good value', 'Great value for a hot-swap board. Setup took two minutes.'],
  ],
  'vela-13-air': [
    [5, 'So light', 'Incredibly lightweight and the battery lasts all day at university.'],
    [
      4,
      'Pretty and portable',
      'Portable and the display is lovely, but the screen is not very bright in sunlight.',
    ],
    [
      4,
      'Good everyday laptop',
      'Fast enough for school work and very quiet. Keyboard is comfortable.',
    ],
    [
      3,
      'Slow with many tabs',
      'Fine for documents but it gets slow and laggy with lots of browser tabs.',
    ],
  ],
  'drift-earbuds': [
    [
      4,
      'Comfortable fit',
      'They fit well and stay in during workouts. Sound is good for the price.',
    ],
    [4, 'Good value', 'Great value earbuds. Pairing was easy.'],
    [
      2,
      'Battery fades',
      'Sound is fine but the battery dies after about three hours, which is disappointing.',
    ],
  ],
};
const DEMO_REVIEWERS = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Riley'];

async function main(): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        name: category.name,
        position: category.position,
        description: category.description ?? null,
        parentId: category.parent ? categoryIds.get(category.parent) : null,
      },
      update: { name: category.name, position: category.position },
    });
    categoryIds.set(category.slug, row.id);
  }

  const brandIds = new Map<string, string>();
  for (const name of brands) {
    const slug = name.toLowerCase();
    const row = await prisma.brand.upsert({
      where: { slug },
      create: { slug, name },
      update: { name },
    });
    brandIds.set(name, row.id);
  }

  // Demo marketplace seller: approved, with test-mode payouts (no money moves).
  const sellerIds = new Map<string, string>();
  {
    const owner = await prisma.user.upsert({
      where: { email: 'seller@demo.nixzora.com' },
      create: {
        email: 'seller@demo.nixzora.com',
        firstName: 'Brightline (demo)',
        roles: { create: [{ role: { connect: { key: 'customer' } } }] },
      },
      update: {},
    });
    const seller = await prisma.seller.upsert({
      where: { handle: 'brightline-audio' },
      create: {
        handle: 'brightline-audio',
        displayName: 'Brightline Audio',
        legalName: 'Brightline Audio LLC (demo)',
        contactEmail: 'seller@demo.nixzora.com',
        description:
          'Speakers and headphones tuned in Baltimore. A demo marketplace seller: products are fictional.',
        status: 'ACTIVE',
        payoutProvider: 'FAKE',
        payoutAccountId: 'fake_acct_demo_brightline',
        detailsSubmitted: true,
        payoutsEnabled: true,
        approvedAt: new Date(),
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
      update: {},
    });
    sellerIds.set(seller.handle, seller.id);
  }

  for (const product of products) {
    const data = {
      title: product.title,
      description: product.description,
      status: 'ACTIVE' as const,
      categoryId: categoryIds.get(product.category)!,
      brandId: brandIds.get(product.brand)!,
      attributes: product.attributes,
      sellerId: product.seller ? sellerIds.get(product.seller)! : null,
    };
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      create: { slug: product.slug, ...data },
      update: data,
    });

    // Demo illustrations bundled with the storefront (public/demo-products): the main view and
    // three more (close-up, angled, on a desk) for the gallery. Added only while the product has
    // demo photos alone, so images uploaded in the Ops Center are never replaced or mixed in.
    const photos = await prisma.productImage.findMany({ where: { productId: row.id } });
    if (photos.every((photo) => photo.storageKey.startsWith('demo/'))) {
      const views = [
        ['', product.title],
        ['-2', `${product.title}, close-up`],
        ['-3', `${product.title}, angled view`],
        ['-4', `${product.title} on a desk`],
      ] as const;
      for (const [position, [suffix, alt]] of views.entries()) {
        const storageKey = `demo/${product.slug}${suffix}.webp`;
        if (!photos.some((photo) => photo.storageKey === storageKey)) {
          await prisma.productImage.create({
            data: { productId: row.id, storageKey, alt, position },
          });
        }
      }
    }

    for (const variant of product.variants) {
      const variantData = {
        title: variant.title,
        barcode: demoBarcode(variant.sku),
        options: variant.options,
        priceCents: variant.price,
        compareAtCents: variant.was ?? null,
        isActive: true,
      };
      const saved = await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        create: { sku: variant.sku, productId: row.id, ...variantData },
        update: variantData,
      });
      await prisma.inventoryItem.upsert({
        where: { variantId: saved.id },
        create: { variantId: saved.id, onHand: variant.stock },
        update: {},
      });
    }
  }

  // Demo reviewers and their reviews (idempotent).
  const reviewerIds: string[] = [];
  for (const [i, name] of DEMO_REVIEWERS.entries()) {
    const email = `reviewer-${i + 1}@demo.nixzora.com`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        firstName: `${name} (demo)`,
        roles: { create: [{ role: { connect: { key: 'customer' } } }] },
      },
      update: {},
    });
    reviewerIds.push(user.id);
  }
  let reviewCount = 0;
  for (const [slug, reviews] of Object.entries(DEMO_REVIEWS)) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) continue;
    for (const [i, [rating, title, body]] of reviews.entries()) {
      const userId = reviewerIds[i % reviewerIds.length]!;
      await prisma.review.upsert({
        where: { productId_userId: { productId: product.id, userId } },
        create: { productId: product.id, userId, rating, title, body, status: 'APPROVED' },
        update: {},
      });
      reviewCount++;
    }
    // The API's outbox worker rebuilds "what customers say" for this product.
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: product.id,
        type: 'reviews.product.changed',
        payload: { productId: product.id },
      },
    });
  }

  // A demo code shoppers can try at checkout.
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    create: {
      code: 'WELCOME10',
      description: '10% off orders of $50 or more',
      type: 'PERCENT',
      value: 1000,
      minSubtotalCents: 5000,
    },
    update: {},
  });

  const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0);
  console.warn(
    `Seeded ${categories.length} categories, ${brands.length} brands, ${products.length} products, ${variantCount} variants, ${reviewCount} reviews and coupon WELCOME10 (demo data).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
