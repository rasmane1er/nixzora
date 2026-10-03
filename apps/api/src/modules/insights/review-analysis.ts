/**
 * Review insights (p6-04): what reviewers praise and complain about, computed from the review
 * text itself. Every number shown to shoppers comes from here, never from a model.
 */

export type ReviewInput = { id: string; rating: number; title: string; body: string };
export type Theme = { label: string; mentions: number };
export type ReviewAnalysis = {
  reviewCount: number;
  averageRating: number;
  /** Share of 4- and 5-star reviews, 0–100. */
  positivePercent: number;
  pros: Theme[];
  cons: Theme[];
};

/** Bump when the analysis changes, so stored insights are rebuilt with it. */
export const ANALYSIS_VERSION = 3;

/** Below this many approved reviews there is nothing reliable to summarize. */
export const MIN_REVIEWS = 3;

/** `label` names the aspect; `praise` / `complaint` override it when the two read differently. */
type Aspect = { label: string; praise?: string; complaint?: string; words: string[] };

const ASPECTS: Record<string, Aspect> = {
  battery: {
    label: 'Battery life',
    words: ['battery', 'charge', 'charging', 'lasts', 'all day', 'hours'],
  },
  display: {
    label: 'Display',
    words: [
      'screen',
      'display',
      'oled',
      'brightness',
      'bright',
      'colors',
      'colours',
      'panel',
      'resolution',
      'sharp',
    ],
  },
  sound: {
    label: 'Sound',
    words: [
      'sound',
      'audio',
      'bass',
      'treble',
      'mic',
      'microphone',
      'noise cancelling',
      'noise canceling',
      'anc',
      'call quality',
    ],
  },
  comfort: {
    label: 'Comfort',
    words: ['comfortable', 'comfort', 'fit', 'fits', 'ears', 'wrist', 'ergonomic', 'hand'],
  },
  build: {
    label: 'Build quality',
    words: [
      'build',
      'quality',
      'sturdy',
      'solid',
      'premium',
      'flimsy',
      'plastic',
      'feels cheap',
      'well made',
    ],
  },
  performance: {
    label: 'Performance',
    words: [
      'runs fast',
      'snappy',
      'speed',
      'performance',
      'lag',
      'laggy',
      'slow',
      'smooth',
      'powerful',
      'fps',
      'compile',
    ],
  },
  keyboard: {
    label: 'Keyboard',
    words: ['keyboard', 'keys', 'typing', 'switches', 'trackpad', 'touchpad'],
  },
  noise: {
    label: 'Noise',
    praise: 'Quiet operation',
    words: ['quiet', 'silent', 'loud', 'fan', 'fans', 'noisy', 'whine'],
  },
  portability: {
    label: 'Portability',
    words: ['lightweight', 'weight', 'heavy', 'portable', 'travel', 'carry', 'backpack'],
  },
  setup: {
    label: 'Setup',
    words: [
      'set up',
      'setup was',
      'setup took',
      'easy setup',
      'pair',
      'pairing',
      'app',
      'easy to use',
    ],
  },
  connectivity: {
    label: 'Connectivity',
    words: [
      'bluetooth',
      'wifi',
      'wi-fi',
      'connection',
      'connects',
      'disconnect',
      'usb',
      'ports',
      'dropout',
    ],
  },
  value: {
    label: 'Value for money',
    words: ['price', 'value', 'worth', 'expensive', 'overpriced', 'deal', 'bargain'],
  },
};

const NEGATIVE = [
  'wish',
  'too ',
  'could be better',
  'not great',
  'not good',
  'poor',
  'died',
  'dies',
  'issue',
  'problem',
  'disappoint',
  'annoying',
  'broke',
  'stopped',
  'worse',
  'worst',
  'only lasts',
  'drains',
  'flimsy',
  'cheap',
  'is loud',
  'loud on',
  'very loud',
  'overpriced',
  'laggy',
  'noisy',
  'heavy',
];
const POSITIVE = [
  'great',
  'love',
  'excellent',
  'amazing',
  'perfect',
  'good',
  'best',
  'fantastic',
  'solid',
  'impressive',
  'easy',
  'quiet',
  'comfortable',
  'fast',
  'smooth',
  'sharp',
  'bright',
];

/** Sentences, split again at "but" / "however": "great screen but the battery dies" is two. */
function clauses(text: string): string[] {
  return text
    .toLowerCase()
    .split(/(?<=[.!?;])\s+|\n+|,?\s+(?:but|however|although|though)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasWord(clause: string, word: string): boolean {
  const phrase = word.trim();
  if (phrase.includes(' ')) return clause.includes(phrase);
  return new RegExp(`\\b${phrase.replace(/-/g, '\\-')}\\b`).test(clause);
}

/** +1 praise, -1 complaint, 0 neutral, for one clause of a review with this star rating. */
function sentiment(clause: string, rating: number): number {
  if (NEGATIVE.some((cue) => hasWord(clause, cue))) return -1;
  if (POSITIVE.some((cue) => hasWord(clause, cue))) return 1;
  return rating >= 4 ? 1 : rating <= 2 ? -1 : 0;
}

export function analyzeReviews(reviews: ReviewInput[]): ReviewAnalysis | null {
  if (reviews.length < MIN_REVIEWS) return null;
  const positive = new Map<string, Set<string>>();
  const negative = new Map<string, Set<string>>();

  for (const review of reviews) {
    for (const clause of clauses(`${review.title}. ${review.body}`)) {
      for (const [key, aspect] of Object.entries(ASPECTS)) {
        if (!aspect.words.some((word) => hasWord(clause, word))) continue;
        const score = sentiment(clause, review.rating);
        const bucket = score > 0 ? positive : score < 0 ? negative : null;
        if (!bucket) continue;
        if (!bucket.has(key)) bucket.set(key, new Set());
        bucket.get(key)!.add(review.id);
      }
    }
  }

  const n = reviews.length;
  const proMin = Math.max(2, Math.ceil(n * 0.2));
  const conMin = n <= 5 ? 1 : 2;
  const count = (map: Map<string, Set<string>>, key: string) => map.get(key)?.size ?? 0;
  const themes = (map: Map<string, Set<string>>, other: Map<string, Set<string>>, min: number) =>
    [...map.keys()]
      .map((key) => ({ key, mentions: count(map, key), opposite: count(other, key) }))
      .filter((t) => t.mentions >= min && t.mentions > t.opposite)
      .sort((a, b) => b.mentions - a.mentions || a.key.localeCompare(b.key))
      .map((t) => {
        const aspect = ASPECTS[t.key]!;
        const label = (map === positive ? aspect.praise : aspect.complaint) ?? aspect.label;
        return { label, mentions: t.mentions };
      });

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / n;
  return {
    reviewCount: n,
    averageRating: Math.round(average * 10) / 10,
    positivePercent: Math.round((reviews.filter((r) => r.rating >= 4).length / n) * 100),
    pros: themes(positive, negative, proMin).slice(0, 4),
    cons: themes(negative, positive, conMin).slice(0, 3),
  };
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The summary sentence written from the analysis alone (local driver and model fallback). */
export function templateSummary(analysis: ReviewAnalysis): string {
  const parts = [
    `${analysis.positivePercent}% of ${analysis.reviewCount} reviewers rate it 4 or 5 stars.`,
  ];
  if (analysis.pros.length) {
    parts.push(
      `They most often praise the ${list(analysis.pros.map((p) => p.label.toLowerCase()))}.`,
    );
  }
  if (analysis.cons.length) {
    parts.push(
      `Some mention concerns about the ${list(analysis.cons.map((c) => c.label.toLowerCase()))}.`,
    );
  }
  return parts.join(' ');
}

/**
 * Guardrail for a model-written summary: short, no links or prices, and every number in it must
 * be one we computed (review count, percentage, average, theme counts). Null when untrustworthy.
 */
export function groundSummary(text: string, analysis: ReviewAnalysis): string | null {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 500) return null;
  if (/https?:|www\.|\$|€|£|<|>/i.test(clean)) return null;
  const allowed = new Set(
    [
      analysis.reviewCount,
      analysis.positivePercent,
      analysis.averageRating,
      4,
      5,
      ...analysis.pros.map((p) => p.mentions),
      ...analysis.cons.map((c) => c.mentions),
    ].map(String),
  );
  for (const match of clean.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!allowed.has(match[0])) return null;
  }
  return clean;
}
