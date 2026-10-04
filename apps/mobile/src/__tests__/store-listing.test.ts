import en from '../../store/listing/en-US.json';
import es from '../../store/listing/es-ES.json';
import fr from '../../store/listing/fr-FR.json';

// App Store Connect and Play Console reject longer text; catching it here saves a failed upload.
const LIMITS = {
  name: 30,
  subtitle: 30,
  shortDescription: 80,
  promotionalText: 170,
  keywords: 100,
  description: 4000,
  whatsNew: 4000,
} as const;

type Listing = Record<keyof typeof LIMITS | 'privacyUrl' | 'supportUrl', string>;
const listings: { file: string; data: Listing }[] = [
  { file: 'en-US.json', data: en },
  { file: 'es-ES.json', data: es },
  { file: 'fr-FR.json', data: fr },
];

describe('store listings (p9-12)', () => {
  it.each(listings)('$file fits the store limits', ({ data }) => {
    for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      const max = LIMITS[field];
      expect(typeof data[field]).toBe('string');
      expect([field, data[field].length <= max]).toEqual([field, true]);
    }
  });

  it.each(listings)('$file has keywords without spaces after commas or repeats', ({ data }) => {
    const words = data.keywords.split(',');
    expect(words.every((w) => w === w.trim() && w.length > 0)).toBe(true);
    expect(new Set(words).size).toBe(words.length);
  });

  it.each(listings)('$file links to pages that exist on the storefront', ({ data }) => {
    expect(data.privacyUrl).toBe('https://nixzora.com/privacy');
    expect(data.supportUrl).toBe('https://nixzora.com/help');
  });

  it('claims nothing the app does not have', () => {
    // Passkeys are web-only (ADR-0019); the app offers Face ID / fingerprint unlock instead.
    for (const { data } of listings) {
      expect(data.description.toLowerCase()).not.toMatch(/passkey|clé d’accès|llave de acceso/);
    }
  });
});
