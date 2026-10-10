/**
 * Demo catalog: electronics, clothing & shoes, home & kitchen, beauty & personal care, and
 * sports & outdoors. Departments and their nesting come from DEPARTMENTS (@nixzora/validation).
 * Every brand and product here is fictional sample data for development and demos.
 * Safe to run repeatedly: rows are matched by slug and SKU and updated in place.
 *
 * Run: pnpm --filter @nixzora/api db:seed
 */
import 'dotenv/config';
import { withConnectionUrls } from '../src/config/connection-urls';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { messagesFor } from '@nixzora/i18n';
import { CATEGORY_DEPARTMENTS } from '@nixzora/validation';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: withConnectionUrls(process.env).DATABASE_URL as string,
  }),
});

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

/** Short descriptions for the top-level departments (category pages show them). */
const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  electronics: 'Computers, phones, audio, gaming and the accessories that go with them.',
  computers: 'Laptops, desktops and everything to build a workstation.',
  'clothing-shoes': 'Everyday clothing, outerwear and shoes.',
  'home-kitchen': 'Kitchen essentials and comfortable things for home.',
  beauty: 'Skincare, hair care and grooming.',
  'sports-outdoors': 'Gear for workouts, hikes and days outside.',
};
const DEPARTMENT_NAMES = messagesFor('en').departments as Record<string, string>;

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
  'Linden',
  'Alder',
  'Stride',
  'Hearth',
  'Ferro',
  'Brewline',
  'Haven',
  'Dewdrop',
  'Aero',
  'Edgeline',
  'Core',
  'Trailhead',
  'Summit',
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

/** Clothing in every color × size, e.g. "Natural / M"; a few sizes run low on stock. */
const apparel = (
  sku: string,
  colors: [code: string, name: string][],
  sizes: string[],
  price: number,
  was?: number,
): VariantSeed[] =>
  colors.flatMap(([code, color], c) =>
    sizes.map((size, s) => ({
      sku: `${sku}-${code}-${size.replace(/\s+/g, '')}`,
      title: `${color} / ${size}`,
      options: { color, size },
      price,
      ...(was ? { was } : {}),
      stock: (c * 7 + s * 5) % 23 === 0 ? 2 : 6 + ((c * 11 + s * 13) % 30),
    })),
  );

/** Clothing & shoes, Home & kitchen, Beauty & personal care, Sports & outdoors. */
const moreProducts: ProductSeed[] = [
  {
    slug: 'linden-organic-tee',
    title: 'Linden organic cotton tee',
    brand: 'Linden',
    category: 'tops',
    description:
      'A midweight crew-neck tee in soft organic cotton that keeps its shape wash after wash.',
    attributes: {
      material: '100% organic cotton',
      fit: 'Regular',
      care: 'Machine wash cold',
      breathable: true,
    },
    variants: apparel(
      'LIN-TEE',
      [
        ['NAT', 'Natural'],
        ['BLK', 'Black'],
        ['SGE', 'Sage'],
      ],
      ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      2400,
    ),
  },
  {
    slug: 'linden-fleece-hoodie',
    title: 'Linden brushed fleece hoodie',
    brand: 'Linden',
    category: 'tops',
    description: 'A warm, brushed-fleece hoodie with a lined hood and a roomy front pocket.',
    attributes: {
      material: '80% cotton, 20% recycled polyester',
      fit: 'Relaxed',
      care: 'Machine wash cold, tumble dry low',
    },
    variants: apparel(
      'LIN-HOOD',
      [
        ['GRY', 'Heather grey'],
        ['NVY', 'Navy'],
      ],
      ['S', 'M', 'L', 'XL', 'XXL'],
      5900,
      6900,
    ),
  },
  {
    slug: 'alder-rain-jacket',
    title: 'Alder packable rain jacket',
    brand: 'Alder',
    category: 'outerwear',
    description:
      'A light waterproof shell that packs into its own pocket, with taped seams and an adjustable hood.',
    attributes: {
      waterproof: true,
      breathable: true,
      material: 'Recycled nylon, 2.5-layer',
      weight_g: 380,
      fit: 'Regular, room for a layer',
    },
    variants: apparel(
      'ALD-RAIN',
      [
        ['OLV', 'Olive'],
        ['BLK', 'Black'],
      ],
      ['S', 'M', 'L', 'XL'],
      12900,
    ),
  },
  {
    slug: 'stride-runner',
    title: 'Stride everyday running shoe',
    brand: 'Stride',
    category: 'shoes',
    description:
      'A cushioned, breathable running shoe for daily miles, with a grippy rubber outsole.',
    attributes: {
      cushioning: 'Responsive foam midsole',
      material: 'Engineered knit upper',
      breathable: true,
      weight_g: 260,
    },
    variants: apparel(
      'STR-RUN',
      [
        ['NVO', 'Navy / Orange'],
        ['BLK', 'Black'],
      ],
      ['US 6', 'US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12'],
      8900,
      10900,
    ),
  },
  {
    slug: 'hearth-electric-kettle',
    title: 'Hearth 1.7 L electric kettle',
    brand: 'Hearth',
    category: 'kitchen',
    description:
      'Boils a full kettle in about four minutes, with a water window and automatic shut-off.',
    attributes: { capacity_l: 1.7, power_w: 1500, auto_shutoff: true, material: 'Stainless steel' },
    variants: [
      {
        sku: 'HRT-KET-BLK',
        title: 'Matte black',
        options: { color: 'Matte black' },
        price: 4900,
        stock: 24,
      },
      { sku: 'HRT-KET-CRM', title: 'Cream', options: { color: 'Cream' }, price: 4900, stock: 9 },
    ],
  },
  {
    slug: 'ferro-cast-iron-skillet',
    title: 'Ferro pre-seasoned cast-iron skillet',
    brand: 'Ferro',
    category: 'kitchen',
    description:
      'Holds heat for a proper sear and goes from stovetop to oven. Gets better with every use.',
    attributes: {
      material: 'Pre-seasoned cast iron',
      oven_safe: true,
      dishwasher_safe: false,
      weight_kg: 2.4,
    },
    variants: [
      { sku: 'FER-SKL-26', title: '26 cm', options: { size: '26 cm' }, price: 3900, stock: 18 },
      { sku: 'FER-SKL-30', title: '30 cm', options: { size: '30 cm' }, price: 4900, stock: 11 },
    ],
  },
  {
    slug: 'brewline-coffee-maker',
    title: 'Brewline 10-cup programmable coffee maker',
    brand: 'Brewline',
    category: 'kitchen',
    description:
      'Set it the night before and wake up to fresh coffee. The glass carafe keeps warm for two hours.',
    attributes: { cups: 10, capacity_l: 1.25, power_w: 900, auto_shutoff: true },
    variants: [
      {
        sku: 'BRW-CM10',
        title: 'Black',
        options: { color: 'Black' },
        price: 7900,
        was: 9900,
        stock: 14,
      },
    ],
  },
  {
    slug: 'haven-throw-blanket',
    title: 'Haven knit throw blanket',
    brand: 'Haven',
    category: 'home-living',
    description: 'A chunky, soft knit throw with fringed ends, big enough for two on the sofa.',
    attributes: { material: 'Recycled cotton knit', length_cm: 170, machine_washable: true },
    variants: [
      { sku: 'HVN-THR-OAT', title: 'Oat', options: { color: 'Oat' }, price: 4500, stock: 20 },
      {
        sku: 'HVN-THR-TER',
        title: 'Terracotta',
        options: { color: 'Terracotta' },
        price: 4500,
        stock: 7,
      },
    ],
  },
  {
    slug: 'dewdrop-hydrating-serum',
    title: 'Dewdrop hydrating serum',
    brand: 'Dewdrop',
    category: 'skincare',
    description:
      'A light, fragrance-free serum with hyaluronic acid and niacinamide for plump, calm skin.',
    attributes: {
      skin_type: 'All skin types',
      key_ingredients: 'Hyaluronic acid, niacinamide',
      fragrance_free: true,
    },
    variants: [
      { sku: 'DEW-SER-30', title: '30 ml', options: { size: '30 ml' }, price: 2800, stock: 40 },
      { sku: 'DEW-SER-50', title: '50 ml', options: { size: '50 ml' }, price: 3900, stock: 22 },
    ],
  },
  {
    slug: 'dewdrop-daily-sunscreen',
    title: 'Dewdrop daily sunscreen SPF 50',
    brand: 'Dewdrop',
    category: 'skincare',
    description: 'A sheer, everyday broad-spectrum sunscreen that leaves no white cast.',
    attributes: {
      spf: 50,
      volume_ml: 50,
      skin_type: 'All skin types',
      water_resistance: '40 minutes',
      fragrance_free: true,
    },
    variants: [
      { sku: 'DEW-SPF50', title: '50 ml', options: { size: '50 ml' }, price: 2200, stock: 35 },
    ],
  },
  {
    slug: 'aero-ionic-hair-dryer',
    title: 'Aero ionic hair dryer',
    brand: 'Aero',
    category: 'hair-care',
    description:
      'Dries fast with less frizz: three heat settings, a cool shot and a concentrator nozzle.',
    attributes: { power_w: 1800, heat_settings: 3, weight_g: 520 },
    variants: [
      {
        sku: 'AER-HD-IVR',
        title: 'Ivory',
        options: { color: 'Ivory' },
        price: 6900,
        was: 8900,
        stock: 16,
      },
      {
        sku: 'AER-HD-BLK',
        title: 'Black',
        options: { color: 'Black' },
        price: 6900,
        was: 8900,
        stock: 12,
      },
    ],
  },
  {
    slug: 'edgeline-beard-trimmer',
    title: 'Edgeline cordless beard trimmer',
    brand: 'Edgeline',
    category: 'grooming',
    description: 'Twenty length settings, a 90-minute battery and a washable head.',
    attributes: { runtime_min: 90, lengths: 20, waterproof: true },
    variants: [
      {
        sku: 'EDG-TRIM',
        title: 'Graphite',
        options: { color: 'Graphite' },
        price: 4900,
        stock: 19,
      },
    ],
  },
  {
    slug: 'core-yoga-mat',
    title: 'Core non-slip yoga mat, 6 mm',
    brand: 'Core',
    category: 'fitness',
    description: 'A cushioned natural-rubber mat that grips on both sides, with a carry strap.',
    attributes: { thickness_mm: 6, length_cm: 183, material: 'Natural rubber', weight_kg: 2.3 },
    variants: [
      { sku: 'COR-MAT-SGE', title: 'Sage', options: { color: 'Sage' }, price: 3500, stock: 26 },
      { sku: 'COR-MAT-PLM', title: 'Plum', options: { color: 'Plum' }, price: 3500, stock: 13 },
    ],
  },
  {
    slug: 'core-adjustable-dumbbells',
    title: 'Core adjustable dumbbells, pair',
    brand: 'Core',
    category: 'fitness',
    description:
      'Turn the dial to change the weight from 2 to 24 kg per hand: a full rack in a corner.',
    attributes: { max_weight_kg: 24, material: 'Steel plates, rubber grip' },
    variants: [
      {
        sku: 'COR-DB-24',
        title: 'Pair, up to 24 kg',
        options: { pack: 'Pair' },
        price: 19900,
        was: 24900,
        stock: 6,
      },
    ],
  },
  {
    slug: 'trailhead-28-backpack',
    title: 'Trailhead 28 L day pack',
    brand: 'Trailhead',
    category: 'outdoor',
    description:
      'A comfortable 28-litre pack for day hikes and commutes, with a padded laptop sleeve and side bottle pockets.',
    attributes: {
      capacity_l: 28,
      water_resistance: 'Rain-resistant fabric',
      material: 'Recycled ripstop nylon',
      weight_kg: 1.1,
    },
    variants: [
      {
        sku: 'TRL-28-BLU',
        title: 'Lake blue',
        options: { color: 'Lake blue' },
        price: 8900,
        stock: 15,
      },
      {
        sku: 'TRL-28-CHR',
        title: 'Charcoal',
        options: { color: 'Charcoal' },
        price: 8900,
        stock: 10,
      },
    ],
  },
  {
    slug: 'summit-insulated-bottle',
    title: 'Summit insulated bottle, 750 ml',
    brand: 'Summit',
    category: 'outdoor',
    description:
      'Double-wall steel keeps drinks cold for 24 hours. Leak-proof lid with a carry loop.',
    attributes: { volume_ml: 750, insulated: true, cold_hours: 24, dishwasher_safe: false },
    variants: [
      { sku: 'SUM-750-CLY', title: 'Clay', options: { color: 'Clay' }, price: 2900, stock: 30 },
      { sku: 'SUM-750-BLK', title: 'Black', options: { color: 'Black' }, price: 2900, stock: 21 },
      { sku: 'SUM-750-SGE', title: 'Sage', options: { color: 'Sage' }, price: 2900, stock: 3 },
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
Object.assign(DEMO_REVIEWS, {
  'linden-organic-tee': [
    [
      5,
      'My new favorite tee',
      'Soft, not see-through, and it kept its shape after a dozen washes.',
    ],
    [4, 'Runs a little long', 'Great fabric. I sized down and it fits perfectly.'],
  ],
  'linden-fleece-hoodie': [
    [5, 'So cozy', 'Warm without being heavy. The hood actually stays up.'],
    [3, 'Pills a bit', 'Comfortable, but some pilling under the arms after a month.'],
  ],
  'stride-runner': [
    [5, 'Comfortable from day one', 'No break-in needed. Light and bouncy on long runs.'],
    [4, 'True to size', 'Good grip in the rain. Laces are a little short.'],
  ],
  'hearth-electric-kettle': [
    [5, 'Fast and quiet', 'Boils quickly and switches off on its own. Looks great on the counter.'],
    [4, 'Good kettle', 'Does the job well. The lid could open a little wider for cleaning.'],
  ],
  'dewdrop-hydrating-serum': [
    [
      5,
      'Gentle on sensitive skin',
      'No fragrance, no stinging, and my skin feels hydrated all day.',
    ],
    [4, 'Nice texture', 'Absorbs fast. The dropper makes it easy not to waste any.'],
  ],
  'core-yoga-mat': [
    [5, 'Does not slip', 'Even in hot yoga it stays put. The strap is handy.'],
    [4, 'Thick and comfy', 'Easy on the knees. It had a rubber smell for the first few days.'],
  ],
} satisfies Record<string, [number, string, string][]>);

async function main(): Promise<void> {
  // Departments come from the shared taxonomy, parents first. Re-seeding also moves an existing
  // category under its parent (e.g. "Audio" under "Electronics").
  const categoryIds = new Map<string, string>();
  for (const department of CATEGORY_DEPARTMENTS) {
    const description = DEPARTMENT_DESCRIPTIONS[department.slug];
    const fields = {
      name: DEPARTMENT_NAMES[department.slug] ?? department.slug,
      position: department.position,
      parentId: department.parent ? (categoryIds.get(department.parent) ?? null) : null,
      // A description edited in the Ops Center is kept; ours only fills a blank one.
      ...(description ? { description } : {}),
    };
    const existing = await prisma.category.findUnique({ where: { slug: department.slug } });
    const row = await prisma.category.upsert({
      where: { slug: department.slug },
      create: { slug: department.slug, ...fields },
      update: existing?.description ? { ...fields, description: existing.description } : fields,
    });
    categoryIds.set(department.slug, row.id);
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

  for (const product of [...products, ...moreProducts]) {
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
    // three more (close-up, angled, on a table) for the gallery. Added only while the product has
    // demo photos alone, so images uploaded in the Ops Center are never replaced or mixed in.
    const photos = await prisma.productImage.findMany({ where: { productId: row.id } });
    if (photos.every((photo) => photo.storageKey.startsWith('demo/'))) {
      const views = [
        ['', product.title],
        ['-2', `${product.title}, close-up`],
        ['-3', `${product.title}, angled view`],
        ['-4', `${product.title}, on a table`],
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

  // Demo questions and answers (p10-05), once per product. Fictional, like the reviews.
  const DEMO_QUESTIONS: Record<string, [string, [string, 'BUYER' | 'SELLER' | 'STAFF'][]][]> = {
    'halo-anc-headphones': [
      [
        'Can I use them with a wired cable on a plane?',
        [['Yes, a 3.5 mm cable comes in the box and works with the battery off.', 'BUYER']],
      ],
      [
        'Do they fold flat for a small bag?',
        [['They fold flat and the case is about the size of a hardcover book.', 'BUYER']],
      ],
    ],
    'brightline-studio-headphones': [
      [
        'Is the cable replaceable?',
        [
          [
            'Yes, it is a standard 3.5 mm cable with a twist lock; spares are on our store page.',
            'SELLER',
          ],
        ],
      ],
    ],
    'vela-13-air': [
      [
        'How many external monitors does it support?',
        [['Two over USB-C (one at 6K), plus the built-in display.', 'STAFF']],
      ],
    ],
    'hearth-electric-kettle': [['Does it have a keep-warm setting?', []]],
  };
  const brightlineOwner = await prisma.user.findUnique({
    where: { email: 'seller@demo.nixzora.com' },
    select: { id: true },
  });
  for (const [slug, questions] of Object.entries(DEMO_QUESTIONS)) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product || (await prisma.productQuestion.count({ where: { productId: product.id } })))
      continue;
    for (const [i, [body, answers]] of questions.entries()) {
      await prisma.productQuestion.create({
        data: {
          productId: product.id,
          userId: reviewerIds[(i + 2) % reviewerIds.length]!,
          body,
          answerCount: answers.length,
          answers: {
            create: answers.map(([text, role], j) => ({
              role,
              body: text,
              userId:
                role === 'SELLER' && brightlineOwner
                  ? brightlineOwner.id
                  : reviewerIds[(i + j) % reviewerIds.length]!,
            })),
          },
        },
      });
    }
  }

  // Demo deals (p10-07), once per product: a week-long day deal, a lightning deal live now and
  // one starting tomorrow. The API starts and ends them on schedule.
  const SEED_ACTOR = '00000000-0000-0000-0000-000000000000';
  const now = Date.now();
  const DEMO_DEALS = [
    {
      slug: 'stride-runner',
      kind: 'DAY' as const,
      percentOff: 20,
      from: 0,
      hours: 7 * 24,
      quantity: null,
    },
    {
      slug: 'drift-earbuds',
      kind: 'LIGHTNING' as const,
      percentOff: 30,
      from: 0,
      hours: 12,
      quantity: 40,
    },
    {
      slug: 'brightline-studio-headphones',
      kind: 'LIGHTNING' as const,
      percentOff: 25,
      from: 20,
      hours: 6,
      quantity: 25,
    },
  ];
  for (const deal of DEMO_DEALS) {
    const product = await prisma.product.findUnique({
      where: { slug: deal.slug },
      select: { id: true, sellerId: true },
    });
    if (!product || (await prisma.deal.count({ where: { productId: product.id } }))) continue;
    await prisma.deal.create({
      data: {
        productId: product.id,
        kind: deal.kind,
        percentOff: deal.percentOff,
        startsAt: new Date(now + deal.from * 3_600_000),
        endsAt: new Date(now + (deal.from + deal.hours) * 3_600_000),
        quantity: deal.quantity,
        sellerId: product.sellerId,
        createdById: product.sellerId && brightlineOwner ? brightlineOwner.id : SEED_ACTOR,
      },
    });
  }

  // Bundle & save (p10-16): two of NIXZORA's own sets, made once.
  const DEMO_BUNDLES = [
    {
      title: 'Desk setup',
      percentOff: 10,
      slugs: ['arden-34-ultrawide', 'lumen-desk-speakers', 'tactile-precision-mouse'],
    },
    {
      title: 'Morning routine',
      percentOff: 15,
      slugs: ['brewline-coffee-maker', 'dewdrop-daily-sunscreen'],
    },
  ];
  for (const bundle of DEMO_BUNDLES) {
    if (await prisma.bundle.count({ where: { title: bundle.title, sellerId: null } })) continue;
    const found = await prisma.product.findMany({
      where: { slug: { in: bundle.slugs }, status: 'ACTIVE', sellerId: null },
      select: { id: true, slug: true },
    });
    if (found.length !== bundle.slugs.length) continue;
    await prisma.bundle.create({
      data: {
        title: bundle.title,
        percentOff: bundle.percentOff,
        createdById: SEED_ACTOR,
        items: {
          create: bundle.slugs.map((slug, position) => ({
            productId: found.find((p) => p.slug === slug)!.id,
            position,
          })),
        },
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
      isPublic: true,
    },
    // Listed in customers' accounts (Coupons & promotions).
    update: { isPublic: true },
  });

  // Sponsored products demo (p10-01): the demo seller gets $50 of ad credit, once, and one
  // campaign promoting its listings. Credit is NIXZORA's promotion, never paid out.
  {
    const sellerId = sellerIds.get('brightline-audio')!;
    const existing = await prisma.adCampaign.findFirst({ where: { sellerId } });
    if (!existing) {
      const listings = await prisma.product.findMany({
        where: { sellerId, status: 'ACTIVE' },
        select: { id: true },
      });
      await prisma.seller.update({ where: { id: sellerId }, data: { adCreditCents: 5000 } });
      await prisma.adCampaign.create({
        data: {
          sellerId,
          name: 'Brightline speakers and headphones',
          dailyBudgetCents: 1000,
          bidCents: 60,
          products: { create: listings.map((listing) => ({ productId: listing.id })) },
        },
      });
    }
  }

  const variantCount = [...products, ...moreProducts].reduce(
    (sum, product) => sum + product.variants.length,
    0,
  );
  console.warn(
    `Seeded ${CATEGORY_DEPARTMENTS.length} categories, ${brands.length} brands, ${products.length + moreProducts.length} products, ${variantCount} variants, ${reviewCount} reviews and coupon WELCOME10 (demo data).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
