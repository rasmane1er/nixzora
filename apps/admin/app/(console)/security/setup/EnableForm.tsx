'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { enableMfa, type EnableState } from '../actions';

export function EnableForm() {
  const [state, action] = useActionState<EnableState, FormData>(enableMfa, {});
  const t = useT('ops');

  if (state.recoveryCodes) {
    return (
      <div className="form">
        <Banner notice={t('mfaNowOn')} />
        <h2>{t('saveCodesTitle')}</h2>
        <p>{t('saveCodesBody')}</p>
        <ul className="codes">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link className="btn btn--primary" href="/">
          {t('savedContinue')}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="form" style={{ maxWidth: 320 }}>
      <Banner error={state.error} />
      <label>
        {t('code')}
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          required
        />
      </label>
      <SubmitButton>{t('turnOn')}</SubmitButton>
    </form>
  );
}
