import { type DealView } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

/** Deals as a table (seller portal and Ops), with an end/cancel button while it can run. */
export async function DealTable({
  deals,
  cancel,
  showStore = false,
  productHref = (slug) => `/p/${slug}`,
}: {
  deals: DealView[];
  cancel: (form: FormData) => Promise<void>;
  showStore?: boolean;
  productHref?: (slug: string) => string;
}) {
  const [t, f] = await Promise.all([getT('deals'), getFormat()]);
  if (!deals.length) return <p className="muted">{t('noDeals')}</p>;
  return (
    <div className="card table-scroll">
      <table className="plain">
        <thead>
          <tr>
            <th>{t('colProduct')}</th>
            {showStore ? <th>{t('colStore')}</th> : null}
            <th>{t('colDeal')}</th>
            <th>{t('colWhen')}</th>
            <th>{t('colSold')}</th>
            <th>{t('colStatus')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>
                <Link href={productHref(deal.product.slug)}>{deal.product.title}</Link>
              </td>
              {showStore ? <td>{deal.seller?.displayName ?? t('houseStore')}</td> : null}
              <td>
                {t(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} ·{' '}
                {t('percentOff', { percent: f.percent(deal.percentOff / 100) })}
                {deal.audience === 'PLUS' ? ` · ${t('audience_PLUS')}` : null}
              </td>
              <td>
                {t('when', { start: f.dateTime(deal.startsAt), end: f.dateTime(deal.endsAt) })}
              </td>
              <td>
                {deal.quantity != null
                  ? t('soldOf', {
                      claimed: f.number(deal.claimed),
                      quantity: f.number(deal.quantity),
                    })
                  : f.number(deal.claimed)}
              </td>
              <td>
                <span className={`pill pill--deal-${deal.status.toLowerCase()}`}>
                  {t(`status_${deal.status}`)}
                </span>
              </td>
              <td>
                {deal.status === 'LIVE' || deal.status === 'SCHEDULED' ? (
                  <form action={cancel}>
                    <input type="hidden" name="id" value={deal.id} />
                    <button className="btn btn--secondary btn--sm" type="submit">
                      {deal.status === 'LIVE' ? t('endNow') : t('cancel')}
                    </button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
