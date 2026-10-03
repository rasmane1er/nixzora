'use client';

import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { confirmMfa, type MfaStep, startMfa } from '../hub-actions';

/** Turning on two-step verification: scan the QR code, enter a code, save the recovery codes. */
export function TwoStepSetup() {
  const t = useT('account');
  const [state, act, pending] = useActionState<MfaStep, FormData>(
    async (current, form) => (current.step === 'idle' ? startMfa() : confirmMfa(current, form)),
    { step: 'idle' },
  );

  if (state.step === 'codes') {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <p className="banner banner--ok" role="status">
          {t('twoStepIsOn')}
        </p>
        <p style={{ margin: 0 }}>{t('recoveryCodesIntro')}</p>
        <ul className="recovery-codes">
          {state.recoveryCodes.map((code) => (
            <li key={code} className="mono">
              {code}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form action={act} className="form" style={{ gap: 12 }}>
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.step === 'idle' ? (
        <div>
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {pending ? t('starting') : t('turnOnTwoStep')}
          </button>
        </div>
      ) : (
        <>
          <ol className="steps">
            <li>{t('stepOpenApp')}</li>
            <li>{t('stepScan')}</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt={t('qrAlt')} width={180} height={180} />
          <p className="mono" style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {state.secret}
          </p>
          <label>
            {t('sixDigitCode')}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          <div>
            <button className="btn btn--primary" type="submit" disabled={pending}>
              {pending ? t('checking') : t('turnOn')}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
