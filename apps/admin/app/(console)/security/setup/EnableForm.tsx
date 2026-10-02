'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { enableMfa, type EnableState } from '../actions';

export function EnableForm() {
  const [state, action] = useActionState<EnableState, FormData>(enableMfa, {});

  if (state.recoveryCodes) {
    return (
      <div className="form">
        <Banner notice="Two-step verification is on." />
        <h2>3. Save your recovery codes</h2>
        <p>
          Each code works once if you lose your phone. Store them in your password manager — this is
          the only time they are shown.
        </p>
        <ul className="codes">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link className="btn btn--primary" href="/">
          I saved them — continue
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="form" style={{ maxWidth: 320 }}>
      <Banner error={state.error} />
      <label>
        Code
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
      <SubmitButton>Turn on</SubmitButton>
    </form>
  );
}
