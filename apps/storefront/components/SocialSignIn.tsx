'use client';

import { type SocialProvidersResponse } from '@nixzora/validation';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { completeSocialSignIn, startSocialSignIn } from '@/app/account/social-actions';
import { useLocale, useT } from './I18nProvider';

/** The language of Apple's own button. */
const APPLE_LOCALE = { en: 'en_US', fr: 'fr_FR', es: 'es_MX' } as const;

type GoogleId = {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup';
    itp_support?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: string;
      size: string;
      text: string;
      shape: string;
      width: number;
      locale?: string;
    },
  ): void;
};
type AppleAuth = {
  init(options: {
    clientId: string;
    scope: string;
    redirectURI: string;
    nonce: string;
    state: string;
    usePopup: boolean;
  }): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    AppleID?: { auth: AppleAuth };
  }
}

/**
 * "Continue with Google" and "Continue with Apple". Each provider's own script renders its
 * button and returns an ID token, which the server verifies with the API. No provider secret
 * lives in the storefront, and buttons only appear for providers the API has configured.
 */
export function SocialSignIn({
  providers,
  next,
  intent = 'signin',
}: {
  providers: SocialProvidersResponse;
  next: string;
  intent?: 'signin' | 'signup';
}) {
  const googleClientId = providers.google?.webClientId ?? null;
  const appleServicesId = providers.apple?.servicesId ?? null;
  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);
  const t = useT('auth');
  const locale = useLocale();

  useEffect(() => {
    if (!googleClientId && !appleServicesId) return;
    void startSocialSignIn().then(setNonce);
  }, [googleClientId, appleServicesId]);

  const complete = useCallback((input: Parameters<typeof completeSocialSignIn>[0]) => {
    setError(null);
    startTransition(async () => {
      const result = await completeSocialSignIn(input);
      if (result?.error) {
        setError(result.error);
        // A nonce is single-use: get a fresh one for the next try.
        setNonce(await startSocialSignIn());
      }
    });
  }, []);

  useEffect(() => {
    const id = window.google?.accounts.id;
    if (!googleReady || !id || !googleClientId || !nonce || !googleButton.current) return;
    id.initialize({
      client_id: googleClientId,
      nonce,
      ux_mode: 'popup',
      itp_support: true,
      use_fedcm_for_button: true,
      callback: ({ credential }) => {
        if (credential) complete({ provider: 'google', idToken: credential, next });
      },
    });
    id.renderButton(googleButton.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: intent === 'signup' ? 'signup_with' : 'continue_with',
      shape: 'rectangular',
      width: Math.min(400, googleButton.current.clientWidth || 320),
      locale,
    });
  }, [googleReady, googleClientId, nonce, next, intent, complete, locale]);

  useEffect(() => {
    if (!appleReady || !window.AppleID || !appleServicesId || !nonce) return;
    window.AppleID.auth.init({
      clientId: appleServicesId,
      scope: 'name email',
      redirectURI: `${window.location.origin}/account/login`,
      nonce,
      state: nonce.slice(0, 16),
      usePopup: true,
    });
  }, [appleReady, appleServicesId, nonce]);

  // Apple's script renders the official button into #appleid-signin and reports the result
  // through these events (popup mode).
  useEffect(() => {
    if (!appleServicesId) return;
    type AppleSuccess = CustomEvent<{
      authorization: { id_token: string };
      user?: { name?: { firstName?: string; lastName?: string } };
    }>;
    const onSuccess = (event: Event) => {
      const { authorization, user } = (event as AppleSuccess).detail;
      complete({
        provider: 'apple',
        idToken: authorization.id_token,
        next,
        firstName: user?.name?.firstName,
        lastName: user?.name?.lastName,
      });
    };
    const onFailure = (event: Event) => {
      // Closing the popup is not an error worth showing.
      const reason = (event as CustomEvent<{ error?: string }>).detail?.error;
      if (reason && reason !== 'popup_closed_by_user' && reason !== 'user_cancelled_authorize') {
        setError(t('appleFailed'));
      }
    };
    document.addEventListener('AppleIDSignInOnSuccess', onSuccess);
    document.addEventListener('AppleIDSignInOnFailure', onFailure);
    return () => {
      document.removeEventListener('AppleIDSignInOnSuccess', onSuccess);
      document.removeEventListener('AppleIDSignInOnFailure', onFailure);
    };
  }, [appleServicesId, next, complete, t]);

  if (!googleClientId && !appleServicesId) return null;

  return (
    <div className="social stack" aria-busy={pending}>
      {googleClientId ? (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onReady={() => setGoogleReady(true)}
          />
          <div ref={googleButton} className="social__google" />
        </>
      ) : null}
      {appleServicesId ? (
        <>
          <Script
            src={`https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${APPLE_LOCALE[locale]}/appleid.auth.js`}
            strategy="afterInteractive"
            onReady={() => setAppleReady(true)}
          />
          <div
            id="appleid-signin"
            className="social__apple"
            data-color="black"
            data-border="true"
            data-type={intent === 'signup' ? 'sign-up' : 'continue'}
            data-mode="center-align"
            data-height="44"
            data-width="100%"
            aria-disabled={!appleReady || !nonce || pending}
          />
        </>
      ) : null}
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="muted small" role="status">
          {t('signingIn')}
        </p>
      ) : null}
      <div className="divider" role="separator">
        <span>{t('orUseEmail')}</span>
      </div>
    </div>
  );
}
