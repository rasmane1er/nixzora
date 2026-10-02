import { formatMoney } from './format';

/** Current price, with the old price struck through when the item is on sale. */
export function Price({
  cents,
  compareAtCents,
  currency = 'USD',
  prefix,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency?: string;
  prefix?: string;
}) {
  const onSale = compareAtCents != null && compareAtCents > cents;
  return (
    <span className="price">
      {prefix ? <span className="price__prefix">{prefix} </span> : null}
      <span className={onSale ? 'price__now price__now--sale' : 'price__now'}>
        {formatMoney(cents, currency)}
      </span>
      {onSale ? (
        <>
          {' '}
          <s className="price__was" aria-label={`was ${formatMoney(compareAtCents, currency)}`}>
            {formatMoney(compareAtCents, currency)}
          </s>
        </>
      ) : null}
    </span>
  );
}
