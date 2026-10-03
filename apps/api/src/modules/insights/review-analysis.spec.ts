import {
  analyzeReviews,
  groundSummary,
  type ReviewInput,
  templateSummary,
} from './review-analysis';

let n = 0;
const review = (rating: number, body: string, title = 'Review'): ReviewInput => ({
  id: `r${++n}`,
  rating,
  title,
  body,
});

const headphones = [
  review(5, 'The sound is amazing and they are so comfortable on long flights.'),
  review(5, 'Great noise cancelling, comfortable for hours. Battery lasts all week.'),
  review(4, 'Sound is great but the battery dies faster than I hoped.'),
  review(4, 'Very comfortable. Setup with the app was easy.'),
  review(2, 'Bluetooth connection keeps dropping, which is annoying. Sound is fine.'),
];

describe('analyzeReviews', () => {
  it('needs at least three reviews', () => {
    expect(analyzeReviews(headphones.slice(0, 2))).toBeNull();
  });

  it('counts praise and complaints per aspect, by distinct review', () => {
    const analysis = analyzeReviews(headphones)!;
    expect(analysis).toMatchObject({ reviewCount: 5, averageRating: 4, positivePercent: 80 });
    expect(analysis.pros).toEqual(
      expect.arrayContaining([
        { label: 'Sound', mentions: 3 },
        { label: 'Comfort', mentions: 3 },
      ]),
    );
    expect(analysis.cons).toEqual([{ label: 'Connectivity', mentions: 1 }]);
    // Battery: praised once ("lasts all week") and criticized once ("great sound but the battery
    // dies"), so it is mixed and listed in neither column.
    const labels = [...analysis.pros, ...analysis.cons].map((t) => t.label);
    expect(labels).not.toContain('Battery life');
  });

  it('reads the complaint after "but" in a mixed sentence', () => {
    const analysis = analyzeReviews([
      review(4, 'Great sound but the battery dies fast.'),
      review(4, 'Lovely sound, though the battery is poor.'),
      review(5, 'Sound is excellent.'),
    ])!;
    expect(analysis.pros).toEqual([{ label: 'Sound', mentions: 3 }]);
    expect(analysis.cons).toEqual([{ label: 'Battery life', mentions: 2 }]);
  });

  it('labels praise and complaints about the same aspect differently', () => {
    const quiet = analyzeReviews([
      review(5, 'Silent while compiling, the fan is quiet.'),
      review(5, 'So quiet in the library.'),
      review(4, 'Quiet and fast.'),
    ])!;
    expect(quiet.pros).toEqual([{ label: 'Quiet operation', mentions: 3 }]);
    const loud = analyzeReviews([
      review(4, 'Keys feel great, but it is loud on video calls.'),
      review(4, 'Typing is fantastic.'),
      review(5, 'Great keyboard.'),
    ])!;
    expect(loud.cons).toEqual([{ label: 'Noise', mentions: 1 }]);
    expect(loud.cons.map((c) => c.label)).not.toContain('Sound');
  });

  it('writes a summary only from the computed facts', () => {
    const text = templateSummary(analyzeReviews(headphones)!);
    expect(text).toMatch(/^80% of 5 reviewers rate it 4 or 5 stars\./);
    expect(text).toContain('praise the');
    expect(text).toContain('concerns about the');
  });
});

describe('groundSummary', () => {
  const analysis = analyzeReviews(headphones)!;

  it('accepts text whose numbers all come from the analysis', () => {
    expect(
      groundSummary('Most of the 5 reviewers (80%) love the sound and comfort.', analysis),
    ).toBe('Most of the 5 reviewers (80%) love the sound and comfort.');
  });

  it('rejects invented numbers, prices, links and long text', () => {
    expect(groundSummary('9 out of 10 reviewers love it.', analysis)).toBeNull();
    expect(groundSummary('Worth every penny at $229.', analysis)).toBeNull();
    expect(groundSummary('See https://example.com for more.', analysis)).toBeNull();
    expect(groundSummary('x'.repeat(600), analysis)).toBeNull();
  });
});
