'use client';

import { GIFT_CARD_AMOUNTS } from '@nixzora/validation';
import { useActionState, useState } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';
import { buyGiftCard, type GiftState } from './actions';

export function GiftCardForm({ senderName }: { senderName?: string }) {
  const t = useT('gifts');
  const f = useFormat();
  const [state, action, pending] = useActionState<GiftState, FormData>(buyGiftCard, {});
  const v = state.values ?? {};
  const [amount, setAmount] = useState(v.amount ?? String(GIFT_CARD_AMOUNTS[1] / 100));
  const [custom, setCustom] = useState(v.custom ?? '');
  const shown = amount === 'custom' ? Number(custom) * 100 : Number(amount) * 100;

  return (
    <form action={action} className="card form gift-form">
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <fieldset className="gift-amounts">
        <legend>{t('amount')}</legend>
        {GIFT_CARD_AMOUNTS.map((cents) => (
          <label key={cents}>
            <input
              type="radio"
              name="amount"
              value={String(cents / 100)}
              checked={amount === String(cents / 100)}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span>{f.money(cents)}</span>
          </label>
        ))}
        <label>
          <input
            type="radio"
            name="amount"
            value="custom"
            checked={amount === 'custom'}
            onChange={() => setAmount('custom')}
          />
          <span>{t('customAmount')}</span>
        </label>
      </fieldset>
      {amount === 'custom' ? (
        <label>
          {t('customAmount')}
          <input
            name="custom"
            type="number"
            min={10}
            max={500}
            step={1}
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            required
          />
        </label>
      ) : null}
      <div className="form-row">
        <label>
          {t('recipientName')}
          <input name="recipientName" required maxLength={60} defaultValue={v.recipientName} />
        </label>
        <label>
          {t('recipientEmail')}
          <input
            name="recipientEmail"
            type="email"
            required
            autoComplete="off"
            defaultValue={v.recipientEmail}
          />
        </label>
      </div>
      <label>
        {t('senderName')}
        <input
          name="senderName"
          required
          maxLength={60}
          defaultValue={v.senderName ?? senderName}
          autoComplete="name"
        />
      </label>
      <label>
        {t('message')}
        <textarea name="message" maxLength={300} rows={3} defaultValue={v.message} />
      </label>
      <p className="hint">{t('howItWorks')}</p>
      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {shown >= 1000 && shown <= 50000 ? t('buyFor', { amount: f.money(shown) }) : t('buy')}
      </button>
    </form>
  );
}
