import { type HelpConversation } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';
import { HelpChat } from './HelpChat';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('helpAgent');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** The help agent (p10-20): a support chat about the shopper's own orders. */
export default async function HelpChatPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const t = await getT('helpAgent');
  const { order } = await searchParams;
  const number = typeof order === 'string' && /^NX-[A-Z0-9]{6}$/i.test(order) ? order : null;
  const head = (
    <div className="assistant-head">
      <p className="eyebrow">
        <Link href="/help">{(await getT('help'))('eyebrow')}</Link>
      </p>
      <h1>{t('title')}</h1>
      <p className="muted">{t('lead')}</p>
    </div>
  );
  if (!(await isSignedIn())) {
    const next = `/help/chat${number ? `?order=${number}` : ''}`;
    return (
      <div className="wrap section">
        {head}
        <div className="card stack" style={{ gap: 12, maxWidth: 560 }}>
          <p style={{ margin: 0 }}>{t('signInLead')}</p>
          <Link
            className="btn btn--primary"
            href={`/account/login?next=${encodeURIComponent(next)}`}
          >
            {t('signIn')}
          </Link>
          <Link href="/help/contact">{t('contactInstead')}</Link>
        </div>
      </div>
    );
  }
  const conversation = await accountApi<HelpConversation>('/me/help', '/help/chat');
  return (
    <div className="wrap section">
      {head}
      <HelpChat
        initial={conversation}
        prefill={number ? t('orderPrefill', { number: number.toUpperCase() }) : ''}
      />
    </div>
  );
}
