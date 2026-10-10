import { type BrowsingHistory } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { clearHistory, removeFromHistory, toggleHistoryAlert } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('history');
  return { title: t('metaTitle'), robots: { index: false } };
}

/**
 * Browsing history (p10-19): products looked at while signed in, the price then and now, a
 * price-drop alert per item, and forgetting one or all of them.
 */
export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [history, t, f] = await Promise.all([
    accountApi<BrowsingHistory>('/me/history', '/account/history'),
    getT('history'),
    getFormat(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {history.paused ? (
        <p className="banner" role="status">
          {t('paused')} <Link href="/account/preferences">{t('preferences')}</Link>
        </p>
      ) : null}
      {history.items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('none')}</p>
        </div>
      ) : (
        <>
          <ul className="history-list">
            {history.items.map(({ product, viewedAt, droppedCents, alertOn }) => (
              <li key={product.id} className="history-item card">
                <Link href={`/p/${product.slug}`} className="history-item__img">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image.url} alt="" width={96} height={96} loading="lazy" />
                  ) : null}
                </Link>
                <div className="history-item__body">
                  <Link href={`/p/${product.slug}`} className="history-item__title">
                    {product.title}
                  </Link>
                  <span>
                    <strong>{f.money(product.priceFromCents, product.currency)}</strong>
                    {droppedCents > 0 ? (
                      <span className="history-item__drop">
                        {' '}
                        · {t('droppedSince', { amount: f.money(droppedCents, product.currency) })}
                      </span>
                    ) : null}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {t('viewed', { date: f.date(viewedAt) })}
                  </span>
                  <div className="history-item__actions">
                    <form action={toggleHistoryAlert}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="on" value={alertOn ? '0' : '1'} />
                      <button
                        className={`btn btn--sm ${alertOn ? 'btn--link' : 'btn--secondary'}`}
                        type="submit"
                        aria-pressed={alertOn}
                      >
                        {alertOn ? `✓ ${t('alertOn')} · ${t('alertOff')}` : t('alertMe')}
                      </button>
                    </form>
                    <form action={removeFromHistory}>
                      <input type="hidden" name="productId" value={product.id} />
                      <button className="btn btn--sm btn--link" type="submit">
                        {t('remove')}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <form action={clearHistory}>
            <p className="hint" style={{ marginTop: 0 }}>
              {t('clearConfirm')}
            </p>
            <button className="btn btn--secondary" type="submit">
              {t('clearAll')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
