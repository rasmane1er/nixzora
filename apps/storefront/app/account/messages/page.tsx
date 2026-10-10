import { type ConversationSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader } from '@/components/AccountHeader';
import { InboxList } from '@/components/InboxList';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** The customer's conversations with stores (p10-12). */
export default async function MessagesPage() {
  const [items, t] = await Promise.all([
    accountApi<ConversationSummary[]>('/me/messages', '/account/messages'),
    getT('inbox'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 860 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      <section className="card">
        {items.length ? (
          <InboxList items={items} hrefBase="/account/messages" />
        ) : (
          <p className="muted">{t('none')}</p>
        )}
      </section>
    </div>
  );
}
