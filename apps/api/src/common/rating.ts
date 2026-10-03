/** A seller's average rating to one decimal, from the running totals kept on the seller. */
export function ratingSummary(seller: { ratingCount: number; ratingTotal: number }): {
  average: number | null;
  count: number;
} {
  return {
    average: seller.ratingCount
      ? Math.round((seller.ratingTotal / seller.ratingCount) * 10) / 10
      : null,
    count: seller.ratingCount,
  };
}
