import { formatMoney } from './format';

/** Current price, with the old price struck through when the item is on sale. */
export function Price({
  cents,
  compareAtCents,
  currency = 'USD',
  prefix,
  locale = 'en-US',
  wasLabel = 'was',
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  prefix?: string;
  /** BCP 47 tag for formatting, e.g. "fr-FR". */
  locale?: string;
  /** Screen-reader word before the old price ("was", "avant", "antes"). */
  wasLabel?: string;
}) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <span className="price">
      {prefix ? <span className="price__prefix">{prefix} </span> : null}
      <span className={onSale ? 'price__now price__now--sale' : 'price__now'}>
        {formatMoney(cents, currency, locale)}
      </span>
      {onSale ? (
        <>
          {' '}
          <s
            className="price__was"
            aria-label={`${wasLabel} ${formatMoney(compareAtCents, currency, locale)}`}
          >
            {formatMoney(compareAtCents, currency, locale)}
          </s>
        </>
      ) : null}
    </span>
  );
}
