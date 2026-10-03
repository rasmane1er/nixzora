'use client';

import { rich } from '@nixzora/i18n';
import { type SavedAddress, US_STATES } from '@nixzora/validation';
import { useActionState, useState } from 'react';
import { useT } from '@/components/I18nProvider';
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
}: {
  email?: string;
  signedIn: boolean;
  addresses: SavedAddress[];
}) {
  const t = useT('checkout');
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

      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? t('placingOrder') : t('continueToPayment')}
      </button>
    </form>
  );
}
