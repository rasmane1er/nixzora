'use client';

import { useActionState } from 'react';
import { confirmMfa, type MfaStep, startMfa } from '../hub-actions';

/** Turning on two-step verification: scan the QR code, enter a code, save the recovery codes. */
export function TwoStepSetup() {
  const [state, act, pending] = useActionState<MfaStep, FormData>(
    async (current, form) => (current.step === 'idle' ? startMfa() : confirmMfa(current, form)),
    { step: 'idle' },
  );

  if (state.step === 'codes') {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <p className="banner banner--ok" role="status">
          Two-step verification is on.
        </p>
        <p style={{ margin: 0 }}>
          Save these recovery codes somewhere safe. Each one signs you in once if you lose your
          phone. They are not shown again.
        </p>
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
            {pending ? 'Starting…' : 'Turn on two-step verification'}
          </button>
        </div>
      ) : (
        <>
          <ol className="steps">
            <li>Open an authenticator app (Google Authenticator, 1Password, Authy…).</li>
            <li>Scan this code, or enter the key by hand.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="QR code for your authenticator app" width={180} height={180} />
          <p className="mono" style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {state.secret}
          </p>
          <label>
            6-digit code from the app
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
              {pending ? 'Checking…' : 'Turn on'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
