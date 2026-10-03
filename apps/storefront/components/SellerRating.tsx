import { INTL_LOCALE } from '@nixzora/i18n';
import { getLocale, getT } from '@/lib/i18n';
import { Stars } from './Stars';

/** "★★★★☆ 4.2 seller rating (18)", from customers' ratings of delivered orders; nothing until rated. */
export async function SellerRating({
  rating,
}: {
  rating: { average: number | null; count: number };
}) {
  if (!rating.count || rating.average === null) return null;
  const t = await getT('productPage');
  const locale = await getLocale();
  const average = new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating.average);
  return (
    <span className="rating-line" style={{ display: 'inline-flex' }}>
      <Stars value={rating.average} size={14} />
      <span>{t('sellerRating', { rating: average, count: rating.count })}</span>
    </span>
  );
}
