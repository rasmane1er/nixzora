'use client';

import { type BundleView } from '@nixzora/validation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addBundleToCart } from '@/app/cart/actions';
import { useFormat, useT } from '@/components/I18nProvider';

/**
 * Bundle & save (p10-16): this product and the others it's bundled with, the price together
 * and the saving, and one button that adds the whole set.
 */
export function BundleOffer({ bundle, currentId }: { bundle: BundleView; currentId: string }) {
  const t = useT('bundles');
  const f = useFormat();
  const router = useRouter();
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const saving = bundle.priceCents - bundle.bundlePriceCents;
  return (
    <section className="card bundle-offer" aria-label={`${t('title')}: ${bundle.title}`}>
      <div className="bundle-offer__head">
        <span className="bundle-offer__tag">{t('title')}</span>
        <strong>{bundle.title}</strong>
      </div>
      <ol className="bundle-offer__items">
        {bundle.products.map((p, i) => (
          <li key={p.id}>
            {i > 0 ? (
              <span className="bundle-offer__plus" aria-hidden="true">
                +
              </span>
            ) : null}
            <span className="bundle-offer__item">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                <img src={p.image.url} alt="" width={72} height={54} />
              ) : null}
              <span>
                {p.id === currentId ? (
                  <strong>{t('thisItem')}</strong>
                ) : (
                  <Link href={`/p/${p.slug}`}>{p.title}</Link>
                )}
                <span className="muted"> · {f.money(p.priceFromCents)}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div className="bundle-offer__total">
        <span>
          {t('total')}: <strong>{f.money(bundle.bundlePriceCents)}</strong>{' '}
          <s className="muted">{f.money(bundle.priceCents)}</s>
          <br />
          <span className="bundle-offer__save">
            {t('save', {
              amount: f.money(saving),
              percent: f.percent(bundle.percentOff / 100),
            })}
          </span>
        </span>
        {bundle.available ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await addBundleToCart(bundle.id);
                if (!result.ok) return setMessage({ error: result.error });
                setMessage({ ok: t('added') });
                router.refresh();
              })
            }
          >
            {pending ? t('addingBundle') : t('addBundle')}
          </button>
        ) : (
          <span className="muted">{t('unavailable')}</span>
        )}
      </div>
      {message.error ? (
        <p className="banner banner--error" role="alert">
          {message.error}
        </p>
      ) : message.ok ? (
        <p className="banner banner--ok" role="status">
          {message.ok} <Link href="/cart">→</Link>
        </p>
      ) : null}
    </section>
  );
}
