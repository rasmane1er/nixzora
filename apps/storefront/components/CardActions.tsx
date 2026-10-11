'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setWish } from '@/app/account/wishlist/actions';
import { addToCart } from '@/app/cart/actions';
import { useT } from './I18nProvider';

/** The heart in a product card's corner: saves to the wishlist (sign-in first if needed). */
export function CardHeart({
  productId,
  title,
  initial,
}: {
  productId: string;
  title: string;
  initial: boolean;
}) {
  const t = useT('product');
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="card-heart"
      aria-pressed={saved}
      aria-label={saved ? t('saved', { title }) : t('save', { title })}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !saved;
          setSaved(next);
          const result = await setWish(productId, next);
          if (!result.ok) {
            setSaved(!next);
            if (result.signIn)
              router.push(`/account/login?next=${encodeURIComponent(location.pathname)}`);
          }
        })
      }
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 20.25s-7.5-4.6-7.5-10.1A4.15 4.15 0 0 1 12 7.6a4.15 4.15 0 0 1 7.5 2.55c0 5.5-7.5 10.1-7.5 10.1Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** "Add to cart" for single-option products; others open the product page to choose. */
export function CardAdd({
  variantId,
  slug,
  title,
  inStock,
}: {
  variantId: string | null | undefined;
  slug: string;
  title: string;
  inStock: boolean;
}) {
  const t = useT('product');
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'added' | 'error'>('idle');
  const [pending, start] = useTransition();
  if (!inStock) {
    return (
      <span className="btn btn--secondary btn--sm card-add" aria-disabled="true">
        {t('soldOut')}
      </span>
    );
  }
  if (!variantId) {
    return (
      <Link
        className="btn btn--secondary btn--sm card-add"
        href={`/p/${slug}`}
        aria-label={t('chooseOptionsFor', { title })}
      >
        {/* On narrow result rows only the icon shows (ADR-0053). */}
        <svg
          className="card-add__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        <span className="card-add__label">{t('chooseOptions')}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="btn btn--primary btn--sm card-add"
      aria-label={t('addTitleToCart', { title })}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await addToCart(variantId, 1);
          setState(result.ok ? 'added' : 'error');
          if (result.ok) router.refresh();
          setTimeout(() => setState('idle'), 2000);
        })
      }
    >
      {state === 'idle' && !pending ? (
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 3.5h2.2l2.3 11h10.7l2.3-7.8H6.2" />
          <circle cx="9" cy="19" r="1.4" />
          <circle cx="17" cy="19" r="1.4" />
        </svg>
      ) : null}
      <span aria-live="polite" className="card-add__label">
        {pending ? t('adding') : state === 'added' ? `✓ ${t('added')}` : t('addToCart')}
      </span>
    </button>
  );
}
