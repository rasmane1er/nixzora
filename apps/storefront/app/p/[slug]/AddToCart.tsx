'use client';

import { optionLabel } from '@nixzora/i18n';
import {
  COLOR_OPTION,
  optionAxes,
  optionState,
  pickVariant,
  SUBSCRIBE_BULK_PERCENT,
  SUBSCRIBE_PERCENT,
  SUBSCRIPTION_INTERVALS,
  type Variant,
} from '@nixzora/validation';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useFormat, useLocale, useT } from '@/components/I18nProvider';
import { addToCart } from '../../cart/actions';
import { buyNow, oneClickBuy } from '../../checkout/actions';
import { subscribeTo } from '../../account/subscriptions/actions';
import { useProductColor } from './ProductColor';

/** Variant picker + quantity + add to cart. Prices shown here are display only; the server re-prices. */
export function AddToCart({
  variants,
  slug,
  oneClick,
  subscribe,
}: {
  variants: Variant[];
  slug: string;
  /** 1-click is set up (p10-09): what it will use, for the note under the button. */
  oneClick?: { shipTo: string; card: string } | null;
  /** Subscribe & Save is offered (p10-11); `ready` when a saved card and address exist. */
  subscribe?: { signedIn: boolean; ready: boolean } | null;
}) {
  const buyable = variants.filter((variant) => variant.isActive);
  // Photos per color (p10-29): a color from the link (a card's swatch) picks its variant.
  const [color, setColor] = useProductColor();
  const firstInStock =
    buyable.find((v) => v.available > 0 && (!color || v.options[COLOR_OPTION] === color)) ??
    buyable.find((v) => v.available > 0) ??
    buyable[0];
  const t = useT('productPage');
  const p = useT('product');
  const f = useFormat();
  const locale = useLocale();
  const axes = useMemo(() => optionAxes(buyable), [buyable]);
  const [selectedId, setSelectedId] = useState(firstInStock?.id);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [buying, startBuying] = useTransition();
  const l = useT('lists');
  const w = useT('wallet');
  const sub = useT('subscribe');
  const [interval, setInterval_] = useState(30);
  const [subscribing, startSubscribing] = useTransition();
  const selected = useMemo(() => buyable.find((v) => v.id === selectedId), [buyable, selectedId]);

  if (!selected) return <p className="banner banner--info">{t('unavailable')}</p>;
  const max = Math.min(10, selected.available);

  function choose(id: string) {
    setSelectedId(id);
    const chosen = buyable.find((v) => v.id === id)?.options[COLOR_OPTION];
    if (chosen) setColor(chosen);
    setQuantity(1);
    setStatus(null);
  }

  function add() {
    if (!selected) return;
    setStatus(null);
    startTransition(async () => {
      const result = await addToCart(selected.id, quantity);
      setStatus(
        result.ok ? { kind: 'ok', text: t('addedToCart') } : { kind: 'error', text: result.error },
      );
    });
  }

  function subscribeNow() {
    if (!selected) return;
    setStatus(null);
    startSubscribing(async () => {
      const result = await subscribeTo(selected.id, quantity, interval, slug);
      setStatus({ kind: 'error', text: result.error });
    });
  }

  function buy(oneClickNow = false) {
    if (!selected) return;
    setStatus(null);
    startBuying(async () => {
      // Goes on to checkout (or the order, for 1-click); only comes back here if something is wrong.
      const result = oneClickNow
        ? await oneClickBuy(selected.id, quantity, slug)
        : await buyNow(selected.id, quantity, slug);
      setStatus({ kind: 'error', text: result.error });
    });
  }

  return (
    <div className="stack">
      {axes ? (
        axes.map((axis) => (
          <div
            key={axis.name}
            className="options"
            role="group"
            aria-label={optionLabel(axis.name, locale)}
          >
            <span style={{ fontWeight: 600 }}>
              {t('optionChosen', {
                name: optionLabel(axis.name, locale),
                value: selected.options[axis.name] ?? '',
              })}
            </span>
            <div className="option-list option-list--chips">
              {axis.values.map((value) => {
                const state = optionState(buyable, selected, axis.name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`option option--chip${state === 'available' ? '' : ' option--out'}`}
                    aria-pressed={selected.options[axis.name] === value}
                    aria-label={state === 'missing' ? t('optionUnavailable', { value }) : value}
                    onClick={() => {
                      choose(pickVariant(buyable, selected, axis.name, value).id);
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : buyable.length > 1 ? (
        <div className="options" role="group" aria-label={t('chooseOption')}>
          <span style={{ fontWeight: 600 }}>{t('choose')}</span>
          <div className="option-list">
            {buyable.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="option"
                aria-pressed={variant.id === selectedId}
                disabled={variant.available === 0}
                onClick={() => choose(variant.id)}
              >
                <span>{variant.title}</span>
                <small>
                  {variant.available === 0
                    ? p('soldOut')
                    : f.money(variant.priceCents, variant.currency)}
                </small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="qty">
        <label>
          {t('quantity')}
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={max === 0}
          >
            {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn--primary"
          type="button"
          onClick={add}
          disabled={pending || max === 0}
          style={{ flex: 1 }}
        >
          {max === 0
            ? p('soldOut')
            : pending
              ? t('adding')
              : t('addToCartPrice', {
                  price: f.money(selected.priceCents * quantity, selected.currency),
                })}
        </button>
      </div>
      {max > 0 ? (
        oneClick ? (
          <div className="one-click">
            <button
              className="btn btn--buy-now"
              type="button"
              onClick={() => buy(true)}
              disabled={buying || pending}
            >
              {buying ? l('buyingNow') : w('oneClick')}
            </button>
            <span className="muted">
              {oneClick.shipTo} · {oneClick.card} ·{' '}
              <Link href="/account/payments">{w('oneClickChange')}</Link>
            </span>
          </div>
        ) : (
          <button
            className="btn btn--buy-now"
            type="button"
            onClick={() => buy()}
            disabled={buying || pending}
          >
            {buying ? l('buyingNow') : l('buyNow')}
          </button>
        )
      ) : null}
      {subscribe && max > 0 ? (
        <div className="subscribe-box">
          <strong>{sub('subscribeSave', { percent: f.percent(SUBSCRIBE_PERCENT / 100) })}</strong>
          <span className="muted">
            {sub('bulkHint', { percent: f.percent(SUBSCRIBE_BULK_PERCENT / 100) })}
          </span>
          {!subscribe.signedIn ? (
            <Link href={`/account/login?next=/p/${slug}`}>{sub('signIn')}</Link>
          ) : !subscribe.ready ? (
            <span className="muted">{sub('needsSetup')}</span>
          ) : (
            <div className="subscribe-box__row">
              <label>
                {sub('every')}
                <select value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
                  {SUBSCRIPTION_INTERVALS.map((days) => (
                    <option key={days} value={days}>
                      {sub(`interval_${days}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={subscribeNow}
                disabled={subscribing || buying || pending}
              >
                {subscribing
                  ? sub('subscribing')
                  : sub('subscribe', {
                      price: f.money(
                        Math.round((selected.priceCents * (100 - SUBSCRIBE_PERCENT)) / 100) *
                          quantity,
                        selected.currency,
                      ),
                    })}
              </button>
              <span className="muted" style={{ flexBasis: '100%' }}>
                {sub('autoRenew')}
              </span>
            </div>
          )}
        </div>
      ) : null}
      <span
        className={`stock${selected.available === 0 ? ' stock--out' : selected.available <= 5 ? ' stock--low' : ''}`}
      >
        {selected.available === 0
          ? p('soldOut')
          : selected.available <= 5
            ? t('onlyLeft', { count: selected.available })
            : t('inStockShips')}
      </span>
      {status ? (
        <p
          className={`banner banner--${status.kind === 'ok' ? 'ok' : 'error'}`}
          role={status.kind === 'ok' ? 'status' : 'alert'}
        >
          {status.text} {status.kind === 'ok' ? <Link href="/cart">{t('viewCart')}</Link> : null}
        </p>
      ) : null}
      <p className="muted mono" style={{ fontSize: 12 }}>
        {t('sku', { sku: selected.sku })}
      </p>
    </div>
  );
}
