/** An average rating to one decimal (4.25 → 4.3). */
export function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A seller's average rating to one decimal, from the running totals kept on the seller. */
export function ratingSummary(seller: { ratingCount: number; ratingTotal: number }): {
  average: number | null;
  count: number;
} {
  return {
    average: seller.ratingCount ? roundRating(seller.ratingTotal / seller.ratingCount) : null,
    count: seller.ratingCount,
  };
}
