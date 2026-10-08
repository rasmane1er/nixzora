import { createHash } from 'node:crypto';

/**
 * Shopping vocabulary for the offline ("local") AI drivers (ADR-0009).
 *
 * Real embedding models learn that "quiet" and "silent" or "flights" and "travel" are related.
 * The local driver cannot, so it maps common shopper words to shared concepts. Both a product's
 * text and a shopper's query pass through the same map, so they meet on the concept even when
 * they share no word. The table is intentionally small and covers the store's departments
 * (electronics, clothing and shoes, home and kitchen, beauty, sports and outdoors); the paid
 * drivers do not use it.
 */
export const CONCEPTS: Record<string, readonly string[]> = {
  quiet: [
    'quiet',
    'quieter',
    'quietest',
    'silent',
    'fanless',
    'noiseless',
    'hush',
    'low-noise',
    'whisper',
  ],
  noise_cancelling: [
    'anc',
    'noise-cancelling',
    'noise-canceling',
    'cancelling',
    'canceling',
    'isolation',
  ],
  travel: [
    'travel',
    'flight',
    'flights',
    'plane',
    'airplane',
    'commute',
    'trip',
    'road',
    'portable',
    'on-the-go',
  ],
  lightweight: [
    'light',
    'lighter',
    'lightest',
    'lightweight',
    'ultralight',
    'thin',
    'slim',
    'kilogram',
    'carry',
  ],
  battery: ['battery', 'all-day', 'unplugged', 'endurance', 'long-lasting'],
  developer: [
    'coding',
    'code',
    'programming',
    'programmer',
    'developer',
    'development',
    'software',
    'engineer',
    'builds',
    'compile',
  ],
  design: [
    'design',
    'designer',
    'photo',
    'photography',
    'editing',
    'color-accurate',
    'calibrated',
    'srgb',
    'creative',
    'oled',
    'video',
  ],
  gaming: ['gaming', 'game', 'gamer', 'games', 'esports', 'controller', 'fps'],
  budget: ['cheap', 'budget', 'affordable', 'inexpensive', 'value', 'friendly', 'student'],
  premium: [
    'premium',
    'best',
    'flagship',
    'high-end',
    'pro',
    'professional',
    'powerhouse',
    'workstation',
  ],
  ergonomic: ['ergonomic', 'ergo', 'wrist', 'wrists', 'posture', 'split', 'tented'],
  comfort: [
    'comfort',
    'comfortable',
    'cushions',
    'cushion',
    'padded',
    'memory-foam',
    'glasses',
    'soft',
  ],
  wireless: ['wireless', 'bluetooth', 'cordless', 'cable-free'],
  laptop: ['laptop', 'laptops', 'notebook', 'ultrabook', 'macbook'],
  desktop: ['desktop', 'tower', 'pc', 'workstation'],
  monitor: ['monitor', 'monitors', 'display', 'screen', 'ultrawide'],
  headphones: ['headphones', 'headphone', 'headset', 'earbuds', 'earphones', 'cans', 'over-ear'],
  speakers: ['speaker', 'speakers', 'soundbar'],
  keyboard: ['keyboard', 'keyboards', 'keeb', 'mechanical'],
  mouse: ['mouse', 'mice', 'trackpad'],
  phone: ['phone', 'smartphone', 'mobile', 'cellphone', 'android'],
  watch: ['watch', 'smartwatch', 'wearable', 'tracker'],
  smart_home: [
    'smart',
    'lamp',
    'lamps',
    'lights',
    'lighting',
    'outlet',
    'switch',
    'appliances',
    'matter',
    'zigbee',
    'thread',
    'plug',
    'hub',
    'automation',
  ],
  fitness: [
    'running',
    'runner',
    'run',
    'jogging',
    'gym',
    'athlete',
    'workout',
    'gps',
    'heart-rate',
    'sleep',
    'fitness',
  ],
  shirt: [
    'tee',
    'tees',
    't-shirt',
    't-shirts',
    'tshirt',
    'shirt',
    'shirts',
    'hoodie',
    'hoodies',
    'sweatshirt',
    'sweater',
    'crewneck',
  ],
  jacket: [
    'jacket',
    'jackets',
    'coat',
    'coats',
    'raincoat',
    'parka',
    'windbreaker',
    'outerwear',
    'shell',
  ],
  shoes: ['shoe', 'shoes', 'sneaker', 'sneakers', 'trainers', 'footwear', 'boots'],
  waterproof: ['waterproof', 'rain', 'rainy', 'water-resistant', 'weatherproof', 'wet', 'downpour'],
  kitchen: [
    'kitchen',
    'kettle',
    'skillet',
    'pan',
    'frying',
    'cookware',
    'cast-iron',
    'coffee',
    'espresso',
    'brew',
    'cooking',
    'cook',
  ],
  cozy: ['blanket', 'throw', 'cozy', 'cosy', 'couch', 'sofa', 'snuggle'],
  skincare: [
    'skincare',
    'skin',
    'serum',
    'moisturizer',
    'moisturiser',
    'sunscreen',
    'sunblock',
    'spf',
    'face',
    'facial',
  ],
  sensitive: ['fragrance-free', 'unscented', 'sensitive', 'gentle', 'hypoallergenic'],
  hair: ['hair', 'dryer', 'hairdryer', 'blow-dryer', 'blowdryer', 'frizz', 'styling'],
  grooming: ['grooming', 'trimmer', 'beard', 'shaver', 'razor', 'clippers', 'stubble'],
  strength: [
    'dumbbell',
    'dumbbells',
    'weights',
    'barbell',
    'strength',
    'kettlebell',
    'lifting',
    'exercise',
  ],
  yoga: ['yoga', 'pilates', 'stretching', 'mat'],
  hiking: [
    'hiking',
    'hike',
    'trail',
    'camping',
    'backpack',
    'daypack',
    'rucksack',
    'outdoor',
    'outdoors',
  ],
  bottle: ['bottle', 'flask', 'tumbler', 'hydration', 'insulated', 'thermos'],
  large_screen: ['big', 'bigger', 'larger', 'large', 'huge', 'wide', '27', '32', '34'],
  high_refresh: ['smooth', '120hz', '144hz', '165hz', 'high-refresh', 'refresh'],
};

/** Changes whenever the table changes, so the local embedder re-embeds documents. */
export const CONCEPTS_VERSION = createHash('sha256')
  .update(JSON.stringify(CONCEPTS))
  .digest('hex')
  .slice(0, 8);

const CONCEPT_OF = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) {
  for (const word of words) if (!CONCEPT_OF.has(word)) CONCEPT_OF.set(word, concept);
}

const STOP = new Set(
  'a an and are as at be but by for from get has have i in is it its me my need of on or our so that the this to under over with without want looking some something good great new really very can you your'.split(
    ' ',
  ),
);

/** Lowercase words, hyphenated terms kept whole, units glued ("32 gb" → "32gb"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d+)\s*(gb|tb|hz|kg|in|inch|mah|w|h|hours?)\b/g, '$1$2')
    .split(/[^a-z0-9.%-]+/)
    .map((word) => word.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((word) => word.length > 0 && !STOP.has(word));
}

/** Light stemming so "laptops"/"laptop" and "flights"/"flight" match. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Optimal string alignment distance (Levenshtein plus adjacent swaps), capped for speed. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, d[i - 2]![j - 2]! + 1);
      d[i]![j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

const VOCABULARY = [...CONCEPT_OF.keys()].filter((word) => /^[a-z]{5,}$/.test(word));
const typoCache = new Map<string, string | undefined>();

/** The concepts a word belongs to (directly, after stemming, or as a one-letter typo). */
export function conceptOf(word: string): string | undefined {
  const direct = CONCEPT_OF.get(word) ?? CONCEPT_OF.get(stem(word));
  if (direct || word.length < 5 || !/^[a-z]+$/.test(word)) return direct;
  if (typoCache.has(word)) return typoCache.get(word);
  // "hedphones" → "headphones": one edit away from a known shopping word (long words only,
  // so short real words like "mic" or "tab" are never "corrected").
  const match = VOCABULARY.find((known) => editDistance(word, known, 1) <= 1);
  const concept = match ? CONCEPT_OF.get(match) : undefined;
  if (typoCache.size > 5_000) typoCache.clear();
  typoCache.set(word, concept);
  return concept;
}

/** Every concept mentioned in a text, each once. */
export function conceptsIn(text: string): string[] {
  const found = new Set<string>();
  for (const word of tokenize(text)) {
    const concept = conceptOf(word);
    if (concept) found.add(concept);
  }
  return [...found];
}
