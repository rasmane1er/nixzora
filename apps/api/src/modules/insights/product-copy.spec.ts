import { checkCopy, type ProductFacts, templateCopy } from './product-copy';

const watch: ProductFacts = {
  title: 'Pulse S smartwatch',
  category: 'Wearables',
  brand: 'Pulse',
  description: 'GPS, heart-rate and sleep tracking with a week of battery.',
  attributes: { gps: true, battery_days: 7, water_resistance: '5 ATM' },
};

describe('templateCopy', () => {
  it('describes the product from its specs', () => {
    expect(templateCopy(watch)).toBe(
      'The Pulse S smartwatch is a wearable from Pulse with GPS, 7 days battery life and water resistance 5 ATM.',
    );
  });
});

describe('checkCopy', () => {
  it('accepts copy whose numbers come from the facts', () => {
    const text =
      'Built for runners, the Pulse S tracks GPS routes, heart rate and sleep, and lasts about 7 days between charges. Water resistant to 5 ATM.';
    expect(checkCopy(text, watch)).toEqual({ text });
  });

  it('rejects invented numbers, prices, links and superlatives', () => {
    const bad = checkCopy(
      'The best smartwatch: 14 days of battery for just $199, see https://example.com.',
      watch,
    );
    expect('problems' in bad && bad.problems.join(' ')).toMatch(/price or link/);
    expect('problems' in bad && bad.problems.join(' ')).toMatch(/superlative/);
    expect('problems' in bad && bad.problems.join(' ')).toMatch(/numbers not in the specs: 14/);
  });
});
