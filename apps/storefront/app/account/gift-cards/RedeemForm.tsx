'use client';

import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { redeemGiftCard, type RedeemState } from './actions';

export function RedeemForm() {
  const t = useT('gifts');
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemGiftCard, {});
  return (
    <form action={action} className="card form">
      <h2>{t('redeemTitle')}</h2>
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : state.ok ? (
        <p className="banner banner--ok" role="status">
          {state.ok}
        </p>
      ) : null}
      <label>
        {t('code')}
        <input
          name="code"
          required
          placeholder={t('codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mono"
          key={state.ok}
        />
      </label>
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {t('redeem')}
        </button>
      </div>
    </form>
  );
}
