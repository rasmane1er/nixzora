import { multiBuyTerms } from '@nixzora/i18n';
import { type MultiBuyView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { api, ApiError } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadOffer = cache(async (id: string): Promise<MultiBuyView | null> => {
  if (!UUID.test(id)) notFound();
  try {
    return await api<MultiBuyView>(`/catalog/multi-buys/${id}`, { auth: false, revalidate: 60 });
  } catch (error) {
    // An ended offer still gets a page that says so (links to it live on in carts and emails).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [offer, t] = await Promise.all([loadOffer((await params).id), getT('multiBuy')]);
  return { title: offer ? multiBuyTerms(t, offer) : t('ended'), robots: { index: !!offer } };
}

/** Buy X, get Y (p10-27): the offer's products, to mix and match. */
export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const [offer, t, f] = await Promise.all([
    loadOffer((await params).id),
    getT('multiBuy'),
    getFormat(),
  ]);
  if (!offer) {
    return (
      <div className="wrap section stack" style={{ gap: 16 }}>
        <h1>{t('ended')}</h1>
        <p>
          <Link href="/deals">{(await getT('deals'))('title')} →</Link>
        </p>
      </div>
    );
  }
  const vars = {
    group: offer.buyQty + offer.getQty,
    get: offer.getQty,
    percent: offer.percentOff,
  };
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <header className="offer-head">
        <span className="card-offer">{t('navTitle')}</span>
        <h1>{multiBuyTerms(t, offer)}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
          {offer.percentOff >= 100 ? t('lead_free', vars) : t('lead_percent', vars)}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          {offer.seller ? (
            <Link href={`/s/${offer.seller.handle}`}>
              {t('from', { store: offer.seller.displayName })}
            </Link>
          ) : (
            t('fromNixzora')
          )}
          {offer.endsAt ? ` · ${t('endsOn', { date: f.date(offer.endsAt) })}` : ''}
        </p>
      </header>
      {offer.products.length ? (
        <div className="grid">
          {offer.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>{t('noProducts')}</p>
        </div>
      )}
    </div>
  );
}
