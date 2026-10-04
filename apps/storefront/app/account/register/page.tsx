import { rich } from '@nixzora/i18n';
import { PHONE_COUNTRIES } from '@nixzora/validation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { SocialSignIn } from '@/components/SocialSignIn';
import { cspNonce } from '@/lib/csp-nonce';
import { getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { socialProviders } from '../social-actions';
import { RegisterForm } from './RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('registerTitle'), robots: { index: false } };
}

const LANGUAGE_COUNTRY = { en: 'US', fr: 'FR', es: 'ES' } as const;

/** The visitor's country from their browser languages ("fr-BF" → BF), else from the language. */
async function guessCountry(locale: keyof typeof LANGUAGE_COUNTRY): Promise<string> {
  const accepted = (await headers()).get('accept-language') ?? '';
  for (const part of accepted.split(',')) {
    const region = part.split(';')[0]?.trim().split('-')[1]?.toUpperCase();
    if (region && PHONE_COUNTRIES.some((c) => c.iso === region)) return region;
  }
  return LANGUAGE_COUNTRY[locale];
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = param(params, 'next') ?? '/account';
  const [providers, t, locale] = await Promise.all([socialProviders(), getT('auth'), getLocale()]);
  const country = await guessCountry(locale);
  const reasons = [
    { icon: <BoxIcon />, title: t('why1Title'), body: t('why1Body') },
    { icon: <HeartIcon />, title: t('why2Title'), body: t('why2Body') },
    { icon: <BoltIcon />, title: t('why3Title'), body: t('why3Body') },
  ];

  return (
    <div className="wrap signup">
      <section className="card signup__form stack">
        <header>
          <h1>{t('registerHeading')}</h1>
          <p className="muted">{t('registerIntro')}</p>
        </header>
        {param(params, 'error') ? (
          <p className="banner banner--error" role="alert">
            {param(params, 'error')}
          </p>
        ) : null}
        <SocialSignIn
          providers={providers}
          next={next}
          intent="signup"
          scriptNonce={await cspNonce()}
        />
        <RegisterForm next={next} defaultCountry={country} />
        <p className="signup__foot">
          {rich(t('alreadyHaveOne'), {
            link: (chunk) => (
              <Link key="login" href={`/account/login?next=${encodeURIComponent(next)}`}>
                {chunk}
              </Link>
            ),
          })}
        </p>
        <p className="signup__privacy muted">
          <LockIcon /> {t('neverSell')}
        </p>
      </section>

      <aside className="card signup__why" aria-labelledby="why-title">
        <h2 id="why-title">{t('whyTitle')}</h2>
        <ul>
          {reasons.map((reason) => (
            <li key={reason.title}>
              <span className="signup__icon">{reason.icon}</span>
              <span>
                <strong>{reason.title}</strong>
                <span className="muted">{reason.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <Image
          className="signup__art"
          src="/account/register-art.webp"
          alt=""
          width={380}
          height={280}
          priority={false}
        />
      </aside>
    </div>
  );
}

const icon = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

function BoxIcon() {
  return (
    <svg {...icon}>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="m3 7 9 5 9-5M12 12v10" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg {...icon}>
      <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg {...icon}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...icon} width={14} height={14}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
