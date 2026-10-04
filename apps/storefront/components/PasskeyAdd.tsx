'use client';

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { type WebAuthnCredentialJson } from '@nixzora/validation';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { passkeyRegistrationOptions, savePasskey } from '@/app/account/passkey-actions';
import { FingerprintIcon } from './FingerprintIcon';
import { useT } from './I18nProvider';

const noop = () => () => undefined;

type Options = Parameters<typeof startRegistration>[0]['optionsJSON'];

/** "Add a passkey": the browser asks for the fingerprint, face or screen lock, then we save it. */
export function PasskeyAdd() {
  const t = useT('account');
  const router = useRouter();
  // null while rendering on the server: the button waits for the browser to answer.
  const supported = useSyncExternalStore<boolean | null>(noop, browserSupportsWebAuthn, () => null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (supported === false) {
    return <p className="hint">{t('passkeysUnsupported')}</p>;
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div>
        <button
          type="button"
          className="btn btn--primary btn--sm passkey-add"
          disabled={pending || supported === null}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const options = await passkeyRegistrationOptions();
              if (!options.ok) {
                if (options.signIn) router.push('/account/login?next=/account/security');
                return setMessage({ tone: 'error', text: options.error });
              }
              let credential: unknown;
              try {
                credential = await startRegistration({
                  optionsJSON: options.value.options as unknown as Options,
                });
              } catch {
                return setMessage({ tone: 'error', text: t('passkeyCancelled') });
              }
              const saved = await savePasskey({
                challengeToken: options.value.challengeToken,
                credential: credential as WebAuthnCredentialJson,
              });
              if ('error' in saved) return setMessage({ tone: 'error', text: saved.error });
              setMessage({ tone: 'ok', text: t('passkeyAdded') });
              router.refresh();
            })
          }
        >
          <FingerprintIcon size={18} />
          {pending ? t('addingPasskey') : t('addPasskey')}
        </button>
      </div>
      {message ? (
        <p
          className={message.tone === 'ok' ? 'banner banner--ok' : 'banner banner--error'}
          role={message.tone === 'ok' ? 'status' : 'alert'}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
