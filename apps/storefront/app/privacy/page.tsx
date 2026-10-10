import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LegalPage } from '@/components/LegalPage';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('legal');
  return { title: t('privacyTitle'), description: t('privacyDescription') };
}

const TAGS = {
  b: (c: string) => <strong key="b">{c}</strong>,
  email: (c: string) => (
    <a key="email" href={`mailto:${CONTACT_EMAIL}`}>
      {c}
    </a>
  ),
  account: (c: string) => (
    <Link key="account" href="/account">
      {c}
    </Link>
  ),
  preferences: (c: string) => (
    <Link key="preferences" href="/account/preferences">
      {c}
    </Link>
  ),
};

export default async function PrivacyPage() {
  const t = await getT('legal');
  const email = { email: CONTACT_EMAIL };
  return (
    <LegalPage title={t('privacyTitle')} updated="2026-10-10" translationNote>
      <p>{t('privacyIntro')}</p>

      <h2>{t('privacyCollectTitle')}</h2>
      <ul>
        <li>{rich(t('privacyCollectAccount'), TAGS)}</li>
        <li>{rich(t('privacyCollectOrders'), TAGS)}</li>
        <li>{rich(t('privacyCollectPayments'), TAGS)}</li>
        <li>{rich(t('privacyCollectActivity'), TAGS)}</li>
        <li>{rich(t('privacyCollectDevice'), TAGS)}</li>
      </ul>

      <h2>{t('privacyUseTitle')}</h2>
      <ul>
        <li>{t('privacyUseOrders')}</li>
        <li>{t('privacyUseAccount')}</li>
        <li>{rich(t('privacyUseRecommend'), TAGS)}</li>
        <li>{rich(t('privacyUseMarketing'), TAGS)}</li>
        <li>{t('privacyUseLegal')}</li>
      </ul>

      <h2>{t('privacyShareTitle')}</h2>
      <p>{t('privacyShareIntro')}</p>
      <ul>
        <li>{t('privacyShareAws')}</li>
        <li>{t('privacyShareStripe')}</li>
        <li>{t('privacyShareSignIn')}</li>
        <li>{t('privacySharePush')}</li>
        <li>{t('privacyShareAi')}</li>
        <li>{t('privacyShareSellers')}</li>
        <li>{t('privacyShareSentry')}</li>
        <li>{t('privacyShareCarriers')}</li>
      </ul>
      <p>{t('privacyShareLaw')}</p>

      <h2>{t('privacyCookiesTitle')}</h2>
      <p>{t('privacyCookiesBody')}</p>

      <h2>{t('privacyRetentionTitle')}</h2>
      <p>{t('privacyRetentionBody')}</p>

      <h2>{t('privacyChoicesTitle')}</h2>
      <ul>
        <li>{rich(t('privacyChoicesUpdate'), TAGS)}</li>
        <li>{t('privacyChoicesClose')}</li>
        <li>{rich(t('privacyChoicesCopy', email), TAGS)}</li>
        <li>{t('privacyChoicesNotifications')}</li>
      </ul>

      <h2>{t('privacySecurityTitle')}</h2>
      <p>{t('privacySecurityBody')}</p>

      <h2>{t('privacyChildrenTitle')}</h2>
      <p>{t('privacyChildrenBody')}</p>

      <h2>{t('privacyChangesTitle')}</h2>
      <p>{rich(t('privacyChangesBody', email), TAGS)}</p>
    </LegalPage>
  );
}
