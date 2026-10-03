import { Stars } from './Stars';

/** "★★★★☆ 4.2 seller rating (18)", from customers' ratings of delivered orders; nothing until rated. */
export function SellerRating({ rating }: { rating: { average: number | null; count: number } }) {
  if (!rating.count || rating.average === null) return null;
  return (
    <span className="rating-line" style={{ display: 'inline-flex' }}>
      <Stars value={rating.average} size={14} />
      <span>
        {rating.average.toFixed(1)} seller rating ({rating.count}{' '}
        {rating.count === 1 ? 'rating' : 'ratings'})
      </span>
    </span>
  );
}
