import { type SavedItem } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';
import { moveSavedToCart, removeSaved } from './actions';

/** Saved for later (p10-21), under the cart: today's price, what changed, back to the cart. */
export async function SavedForLater({ items }: { items: SavedItem[] }) {
  if (!items.length) return null;
  const [t, f] = await Promise.all([getT('saved'), getFormat()]);
  return (
    <section className="saved" aria-labelledby="saved-title" id="saved">
      <h2 id="saved-title">{t('title', { count: items.length })}</h2>
      <ul className="saved__list">
        {items.map((item) => {
          const change = item.priceCents - item.savedPriceCents;
          return (
            <li key={item.variantId} className="saved__item card">
              <Link href={`/p/${item.productSlug}`} className="saved__img">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" width={120} height={120} loading="lazy" />
                ) : null}
              </Link>
              <div className="saved__body">
                <Link href={`/p/${item.productSlug}`} className="saved__title">
                  {item.productTitle}
                </Link>
                <span className="muted" style={{ fontSize: 13 }}>
                  {item.variantTitle} · {t('qty', { count: item.quantity })}
                </span>
                <strong>{f.money(item.priceCents, item.currency)}</strong>
                {change < 0 ? (
                  <span className="saved__down">
                    {t('priceDown', { amount: f.money(-change, item.currency) })}
                  </span>
                ) : change > 0 ? (
                  <span className="saved__up">
                    {t('priceUp', { amount: f.money(change, item.currency) })}
                  </span>
                ) : null}
                {item.problem ? <span className="field-error">{t('unavailable')}</span> : null}
                <div className="saved__actions">
                  {item.problem ? null : (
                    <form action={moveSavedToCart}>
                      <input type="hidden" name="variantId" value={item.variantId} />
                      <button className="btn btn--secondary btn--sm" type="submit">
                        {t('moveToCart')}
                      </button>
                    </form>
                  )}
                  <form action={removeSaved}>
                    <input type="hidden" name="variantId" value={item.variantId} />
                    <button className="btn btn--link btn--sm" type="submit">
                      {t('remove')}
                    </button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
