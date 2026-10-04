'use client';

import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  WebAuthnAbortService,
} from '@simplewebauthn/browser';
import { type WebAuthnCredentialJson } from '@nixzora/validation';
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import { completePasskeySignIn, passkeySignInOptions } from '@/app/account/passkey-actions';
import { useT } from './I18nProvider';
import { FingerprintIcon } from './FingerprintIcon';

const noop = () => () => undefined;

type Options = Parameters<typeof startAuthentication>[0]['optionsJSON'];

/**
 * "Sign in with a passkey": Touch ID, Face ID, Windows Hello, a phone's fingerprint or a
 * security key. Browsers that support it also offer saved passkeys right in the email field
 * (autocomplete="username webauthn"), so one tap signs in.
 */
export function PasskeySignIn({ next, divider = false }: { next: string; divider?: boolean }) {
  const t = useT('auth');
  const supported = useSyncExternalStore(noop, browserSupportsWebAuthn, () => false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const finish = async (challengeToken: string, credential: unknown) => {
    const result = await completePasskeySignIn({
      challengeToken,
      credential: credential as WebAuthnCredentialJson,
      next,
    });
    if (result?.error) setError(result.error);
  };

  useEffect(() => {
    let active = true;
    // Passkeys offered in the email field's autofill. Runs quietly until the shopper picks one.
    void (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      const options = await passkeySignInOptions();
      if (!options.ok || !active) return;
      try {
        const credential = await startAuthentication({
          optionsJSON: options.value.options as unknown as Options,
          useBrowserAutofill: true,
        });
        await finish(options.value.challengeToken, credential);
      } catch {
        // Cancelled, or replaced by the button's request: nothing to show.
      }
    })();
    return () => {
      active = false;
      WebAuthnAbortService.cancelCeremony();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page
  }, []);

  if (!supported) return null;
  return (
    <div className="passkey-signin">
      <button
        type="button"
        className="btn btn--secondary passkey-signin__button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const options = await passkeySignInOptions();
            if (!options.ok) return setError(options.error);
            try {
              const credential = await startAuthentication({
                optionsJSON: options.value.options as unknown as Options,
              });
              await finish(options.value.challengeToken, credential);
            } catch {
              setError(t('passkeyFailed'));
            }
          })
        }
      >
        <FingerprintIcon />
        <span>
          <strong>{t('signInWithPasskey')}</strong>
          <small>{t('passkeyHint')}</small>
        </span>
      </button>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      {divider ? (
        <div className="divider" role="separator">
          <span>{t('orUseEmail')}</span>
        </div>
      ) : null}
    </div>
  );
}
