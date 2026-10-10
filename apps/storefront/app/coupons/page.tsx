import { type CouponsPage } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipButton } from '@/components/ClipButton';
import { api } from '@/lib/api';
import { couponLabel } from '@/lib/coupons';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('clips');
  return {
    title: t('pageMeta'),
    description: t('pageLead'),
    alternates: { canonical: '/coupons' },
  };
}

/** Clip coupons (p10-18): every live coupon, clipped or not. */
export default async function CouponsPageView() {
  const [t, f, page] = await Promise.all([
    getT('clips'),
    getFormat(),
    api<CouponsPage>('/catalog/coupons').catch((): CouponsPage => ({ coupons: [], clipped: [] })),
  ]);
  const clipped = new Set(page.clipped);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{t('pageTitle')}</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          {t('pageLead')}
        </p>
      </div>
      {page.coupons.length ? (
        <ul className="coupon-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {page.coupons.map((c) => (
            <li key={c.id} className="card coupon-card">
              <Link href={`/p/${c.product.slug}`}>
                {c.product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product photo from our CDN
                  <img src={c.product.image.url} alt={c.product.image.alt} loading="lazy" />
                ) : null}
              </Link>
              <Link href={`/p/${c.product.slug}`} style={{ fontWeight: 600 }}>
                {c.product.title}
              </Link>
              <span>{f.money(c.product.priceFromCents)}</span>
              <ClipButton
                couponId={c.id}
                label={couponLabel(c, t, f)}
                initial={clipped.has(c.id)}
                compact
              />
              <span className="hint">{t('endsOn', { date: f.date(c.endsAt) })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="banner banner--info">{t('none')}</p>
      )}
    </div>
  );
}
