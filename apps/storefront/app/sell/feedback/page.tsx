import { INTL_LOCALE, rich } from '@nixzora/i18n';
import { type SellerFeedback } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerNav } from '@/components/SellerNav';
import { Stars } from '@/components/Stars';
import { api } from '@/lib/api';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { requireSeller } from '@/lib/sell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaFeedback'), robots: { index: false } };
}

/**
 * What customers say (p7-07): the store's rating with private comments, and return requests
 * that include its items. NIXZORA decides returns; refunds of your items show in Earnings.
 */
export default async function SellerFeedbackPage() {
  const seller = await requireSeller('/sell/feedback');
  const feedback = await api<SellerFeedback>('/seller/feedback');
  const { rating } = feedback;
  const [t, f, locale] = await Promise.all([getT('sellerTools'), getFormat(), getLocale()]);
  const day = (iso: string) => f.date(iso);
  const oneDecimal = new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const open = feedback.returns.filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/feedback" />

      <section className="card stack">
        <h2>{t('yourRating')}</h2>
        {rating.count && rating.average !== null ? (
          <div className="reviews">
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 32 }}>{oneDecimal.format(rating.average)}</strong>
              <Stars value={rating.average} />
              <span className="muted" style={{ fontSize: 14 }}>
                {t('ratingFrom', { count: rating.count })}
              </span>
            </div>
            <div className="histogram" aria-label={t('ratingsBreakdown')}>
              {(['5', '4', '3', '2', '1'] as const).map((star) => (
                <div key={star}>
                  <span>{t('starRow', { count: Number(star) })}</span>
                  <meter min={0} max={rating.count} value={rating.breakdown[star]} />
                  <span className="muted">{rating.breakdown[star]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">{t('noRatings')}</p>
        )}
      </section>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>{t('returnRequests')}</h2>
          {open.length ? (
            <span className="pill pill--seller-order-paid">
              {t('openCount', { count: open.length })}
            </span>
          ) : null}
        </div>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {rich(t('returnsIntro'), {
            link: (chunk) => (
              <Link key="earnings" href="/sell/earnings">
                {chunk}
              </Link>
            ),
          })}
        </p>
        {feedback.returns.length === 0 ? (
          <p className="muted">{t('noReturns')}</p>
        ) : (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colOrder')}</th>
                  <th>{t('colItems')}</th>
                  <th>{t('colReason')}</th>
                  <th>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {feedback.returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="mono">{r.orderNumber}</span>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {day(r.createdAt)}
                      </div>
                    </td>
                    <td>
                      {r.items.map((item) => (
                        <div key={item.orderItemId}>
                          {item.quantity} × {item.productTitle}
                        </div>
                      ))}
                    </td>
                    <td>
                      {r.reason}
                      {r.customerNote ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          “{r.customerNote}”
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {t(`return_${r.status}`)}
                      {r.staffNote ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {r.staffNote}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>{t('commentsTitle')}</h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          {t('commentsPrivate')}
        </p>
        {feedback.ratings.length === 0 ? (
          <p className="muted">{t('nothingYet')}</p>
        ) : (
          <ul className="shipments">
            {feedback.ratings.map((r) => (
              <li key={r.id}>
                <div className="rating-line">
                  <Stars value={r.rating} size={14} />
                  <span className="muted">
                    <span className="mono">{r.orderNumber}</span> · {day(r.updatedAt)}
                  </span>
                </div>
                {r.comment ? <p style={{ margin: 0 }}>{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
