import { type MeResponse } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';
import { GiftCardForm } from './GiftCardForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('gifts');
  return {
    title: t('metaTitle'),
    description: t('lead'),
    alternates: { canonical: '/gift-cards' },
  };
}

/** Buy an e-gift card (p10-10). */
export default async function GiftCardsPage() {
  const t = await getT('gifts');
  const signedIn = await isSignedIn();
  const me = signedIn ? await api<MeResponse>('/auth/me').catch(() => null) : null;
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 760 }}>
      <div className="gift-hero" aria-hidden="true">
        <span className="gift-hero__logo">NIXZORA</span>
        <span className="gift-hero__label">{t('metaTitle')}</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{t('title')}</h1>
        <p className="muted">{t('lead')}</p>
      </div>
      {signedIn ? (
        <GiftCardForm senderName={me?.firstName ?? undefined} />
      ) : (
        <Link className="btn btn--primary" href="/account/login?next=/gift-cards">
          {t('signInToBuy')}
        </Link>
      )}
      {signedIn ? (
        <Link href="/account/gift-cards" className="muted">
          {t('redeemTitle')} →
        </Link>
      ) : null}
    </div>
  );
}
