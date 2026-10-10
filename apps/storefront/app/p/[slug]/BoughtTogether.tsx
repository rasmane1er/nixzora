'use client';

import { type ProductCard } from '@nixzora/validation';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addAllToCart } from '@/app/cart/actions';
import { useFormat, useT } from '@/components/I18nProvider';

type Item = {
  variantId: string;
  title: string;
  slug: string;
  priceCents: number;
  image: string | null;
};

/**
 * Frequently bought together (p10-06): this item and what is often ordered with it, ticked by
 * default, with the total and one "Add all to cart" button. Only products that need no option
 * choice can be added from here.
 */
export function BoughtTogether({
  title,
  current,
  others,
}: {
  title: string;
  current: Item | null;
  others: ProductCard[];
}) {
  const c = useT('community');
  const f = useFormat();
  const router = useRouter();
  const items: Item[] = [
    ...(current ? [current] : []),
    ...others
      .filter((p) => p.inStock && p.defaultVariantId)
      .slice(0, 3)
      .map((p) => ({
        variantId: p.defaultVariantId!,
        title: p.title,
        slug: p.slug,
        priceCents: p.priceFromCents,
        image: p.image?.url ?? null,
      })),
  ];
  const [chosen, setChosen] = useState<Set<string>>(new Set(items.map((i) => i.variantId)));
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  if (items.length < 2) return null;

  const picked = items.filter((i) => chosen.has(i.variantId));
  const total = picked.reduce((sum, i) => sum + i.priceCents, 0);
  return (
    <section className="section bundle card" aria-labelledby="bundle-title">
      <h2 id="bundle-title">{title}</h2>
      <ul className="bundle__items">
        {items.map((item, i) => (
          <li key={item.variantId}>
            <label>
              <input
                type="checkbox"
                checked={chosen.has(item.variantId)}
                aria-label={c('bundleChoose', { title: item.title })}
                onChange={() =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (next.has(item.variantId)) next.delete(item.variantId);
                    else next.add(item.variantId);
                    return next;
                  })
                }
              />
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                <img src={item.image} alt="" width={64} height={48} />
              ) : null}
              <span>
                {current && i === 0 ? <strong>{c('bundleThisItem')}: </strong> : null}
                {i === 0 && current ? item.title : <a href={`/p/${item.slug}`}>{item.title}</a>}
                <span className="muted"> · {f.money(item.priceCents)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="bundle__total">
        <strong>{c('bundleTotal', { count: picked.length, price: f.money(total) })}</strong>
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending || !picked.length}
          onClick={() =>
            start(async () => {
              const result = await addAllToCart(picked.map((i) => i.variantId));
              if (!result.ok) return setMessage({ error: result.error });
              setMessage({ ok: c('bundleAdded', { count: picked.length }) });
              router.refresh();
            })
          }
        >
          {c('bundleAdd', { count: picked.length })}
        </button>
      </div>
      {message.error ? (
        <p className="banner banner--error" role="alert">
          {message.error}
        </p>
      ) : message.ok ? (
        <p className="banner banner--ok" role="status">
          {message.ok}
        </p>
      ) : null}
    </section>
  );
}
