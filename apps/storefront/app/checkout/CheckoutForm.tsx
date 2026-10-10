'use client';

import { cardBrand, rich } from '@nixzora/i18n';
import { type PaymentCardView, type SavedAddress, US_STATES } from '@nixzora/validation';
import { useActionState, useState } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';
import { type CheckoutState, placeOrder } from './actions';

type Defaults = Partial<
  Record<
    'email' | 'fullName' | 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'phone',
    string
  >
>;

function fromSaved(address: SavedAddress): Defaults {
  return {
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    phone: address.phone ?? '',
  };
}

export function CheckoutForm({
  email,
  signedIn,
  addresses,
  buyNowId,
  cards = [],
  giftBalanceCents = 0,
}: {
  /** Gift card balance to spend first (p10-10). */
  giftBalanceCents?: number;
  email?: string;
  signedIn: boolean;
  addresses: SavedAddress[];
  /** Saved cards that can pay now (p10-09). */
  cards?: PaymentCardView[];
  /** Checking out a Buy now cart instead of the shopper's cart (p10-05). */
  buyNowId?: string;
}) {
  const t = useT('checkout');
  const w = useT('wallet');
  const g = useT('gifts');
  const f = useFormat();
  const usable = cards.filter((card) => !card.expired);
  const [cardId, setCardId] = useState(
    () => usable.find((card) => card.isDefault)?.id ?? usable[0]?.id ?? '',
  );
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, {});
  const initial = addresses[0] ? fromSaved(addresses[0]) : {};
  const [defaults, setDefaults] = useState<Defaults>({ email, ...initial });
  const [formKey, setFormKey] = useState(0);
  const v = { ...defaults, ...state.values };
  const err = state.fieldErrors ?? {};

  const field = (
    name: keyof Defaults,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label>
      {label}
      <input name={name} defaultValue={v[name]} aria-invalid={Boolean(err[name])} {...props} />
      {err[name] ? <span className="field-error">{err[name]}</span> : null}
    </label>
  );

  return (
    // Remount after each attempt so every field (selects included) shows what was submitted.
    <form action={action} className="form" key={`${formKey}:${JSON.stringify(state.values ?? {})}`}>
      {buyNowId ? <input type="hidden" name="buyNowId" value={buyNowId} /> : null}
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <section className="card form">
        <h2>{t('contact')}</h2>
        {field('email', t('emailForReceipt'), {
          type: 'email',
          autoComplete: 'email',
          required: true,
          readOnly: signedIn,
        })}
        {!signedIn ? (
          <p className="hint">
            {rich(t('guestNotice'), {
              link: (chunk) => (
                <a key="link" href="/account/login?next=/checkout">
                  {chunk}
                </a>
              ),
            })}
          </p>
        ) : null}
      </section>

      <section className="card form">
        <h2>{t('shippingAddress')}</h2>
        {addresses.length > 1 ? (
          <label>
            {t('savedAddresses')}
            <select
              onChange={(e) => {
                const chosen = addresses.find((a) => a.id === e.target.value);
                if (chosen) {
                  setDefaults((d) => ({ ...d, ...fromSaved(chosen) }));
                  setFormKey((k) => k + 1);
                }
              }}
              defaultValue={addresses[0]?.id}
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ? `${a.label}: ` : ''}
                  {a.line1}, {a.city}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {field('fullName', t('fullName'), { autoComplete: 'name', required: true })}
        {field('line1', t('address'), { autoComplete: 'address-line1', required: true })}
        {field('line2', t('line2'), { autoComplete: 'address-line2' })}
        <div className="form-row">
          {field('city', t('city'), { autoComplete: 'address-level2', required: true })}
          <label>
            {t('state')}
            <select
              name="region"
              defaultValue={v.region ?? ''}
              required
              autoComplete="address-level1"
              aria-invalid={Boolean(err.region)}
            >
              <option value="" disabled>
                {t('choose')}
              </option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {err.region ? <span className="field-error">{err.region}</span> : null}
          </label>
          {field('postalCode', t('zip'), {
            autoComplete: 'postal-code',
            inputMode: 'numeric',
            required: true,
            pattern: '\\d{5}(-\\d{4})?',
          })}
        </div>
        {field('phone', t('phone'), {
          type: 'tel',
          autoComplete: 'tel',
        })}
        {signedIn ? (
          <label className="check">
            <input type="checkbox" name="saveAddress" defaultChecked={addresses.length === 0} />{' '}
            {t('saveAddress')}
          </label>
        ) : null}
        <p className="hint">{t('shipWithinUs')}</p>
      </section>

      {signedIn ? (
        <section className="card form">
          <h2>{w('payWith')}</h2>
          {giftBalanceCents > 0 ? (
            <label className="check">
              <input type="checkbox" name="useGiftBalance" defaultChecked />{' '}
              {g('useBalance', { amount: f.money(giftBalanceCents) })}
            </label>
          ) : null}
          {usable.length ? (
            <div className="pay-choice" role="radiogroup" aria-label={w('payWith')}>
              {usable.map((card) => (
                <label key={card.id}>
                  <input
                    type="radio"
                    name="paymentCardId"
                    value={card.id}
                    checked={cardId === card.id}
                    onChange={() => setCardId(card.id)}
                  />
                  {w('cardLabel', { brand: cardBrand(card.brand), last4: card.last4 })}
                </label>
              ))}
              <label>
                <input
                  type="radio"
                  name="paymentCardId"
                  value=""
                  checked={cardId === ''}
                  onChange={() => setCardId('')}
                />
                {w('newCard')}
              </label>
            </div>
          ) : null}
          {cardId === '' ? (
            <label className="check">
              <input type="checkbox" name="saveCard" /> {w('saveCard')}
              <span className="hint" style={{ display: 'block' }}>
                {w('saveCardHint')}
              </span>
            </label>
          ) : null}
        </section>
      ) : null}

      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? t('placingOrder') : cardId ? w('placeOrder') : t('continueToPayment')}
      </button>
    </form>
  );
}
