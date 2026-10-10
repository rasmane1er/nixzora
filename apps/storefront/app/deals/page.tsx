import { multiBuyTerms } from '@nixzora/i18n';
import { type DealKind, type DealsPage, type MultiBuyView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('deals');
  return { title: t('metaTitle'), description: t('lead'), alternates: { canonical: '/deals' } };
}

const KINDS: {
  kind: DealKind | undefined;
  label: 'filterAll' | 'filterLightning' | 'filterDay';
}[] = [
  { kind: undefined, label: 'filterAll' },
  { kind: 'LIGHTNING', label: 'filterLightning' },
  { kind: 'DAY', label: 'filterDay' },
];

/** Today's deals (p10-07): live deals ending soonest first, then what starts next. */
export default async function DealsPageView({ searchParams }: { searchParams: SearchParams }) {
  const raw = param(await searchParams, 'kind');
  const kind = raw === 'LIGHTNING' || raw === 'DAY' ? raw : undefined;
  const [t, pl, mb, f, page, offers] = await Promise.all([
    getT('deals'),
    getT('plus'),
    getT('multiBuy'),
    getFormat(),
    api<DealsPage>(`/catalog/deals${kind ? `?kind=${kind}` : ''}`, { revalidate: 30 }).catch(
      () => null,
    ),
    // Buy X, get Y (p10-27): live offers to mix and match.
    kind
      ? []
      : api<MultiBuyView[]>('/catalog/multi-buys', { auth: false, revalidate: 60 }).catch(
          (): MultiBuyView[] => [],
        ),
  ]);
  const live = page?.live ?? [];
  const upcoming = page?.upcoming ?? [];

  return (
    <div className="wrap section">
      <h1>{t('title')}</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        {t('lead')}
      </p>
      <nav className="seller-tabs deal-tabs" aria-label={t('title')}>
        {KINDS.map((k) => (
          <Link
            key={k.label}
            href={k.kind ? `/deals?kind=${k.kind}` : '/deals'}
            aria-current={k.kind === kind ? 'page' : undefined}
          >
            {t(k.label)}
          </Link>
        ))}
      </nav>

      {live.length ? (
        <div className="grid">
          {live.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="banner banner--info">{t('none')}</p>
      )}

      {offers.length ? (
        <section className="section" aria-labelledby="deals-offers">
          <h2 id="deals-offers">{mb('navTitle')}</h2>
          <ul className="deal-upcoming">
            {offers.map((o) => (
              <li key={o.id}>
                <Link href={`/offers/${o.id}`}>
                  {o.products[0]?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                    <img
                      src={o.products[0].image.url}
                      alt=""
                      width={64}
                      height={48}
                      loading="lazy"
                    />
                  ) : null}
                  <span>
                    <strong>{multiBuyTerms(mb, o)}</strong>
                    <span className="muted">
                      {o.seller ? mb('from', { store: o.seller.displayName }) : mb('fromNixzora')} ·{' '}
                      {mb('productCount', { count: o.products.length })}
                      {o.endsAt ? ` · ${mb('endsOn', { date: f.date(o.endsAt) })}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length ? (
        <section className="section" aria-labelledby="deals-upcoming">
          <h2 id="deals-upcoming">{t('upcomingTitle')}</h2>
          <ul className="deal-upcoming">
            {upcoming.map((u) => (
              <li key={u.product.id}>
                <Link href={`/p/${u.product.slug}`}>
                  {u.product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                    <img src={u.product.image.url} alt="" width={64} height={48} loading="lazy" />
                  ) : null}
                  <span>
                    <strong>{u.product.title}</strong>
                    <span className="muted">
                      {t(u.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} ·{' '}
                      {t('percentOff', { percent: f.percent(u.percentOff / 100) })} ·{' '}
                      {t('startsAt', { time: f.dateTime(u.startsAt) })}
                    </span>
                    {u.earlyAccess ? (
                      <span className="plus-price">
                        <span className="plus-chip">{pl('badge')}</span> {pl('earlyAccessNow')}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
