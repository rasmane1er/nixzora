import { type ConversationSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import { InboxList } from '@/components/InboxList';
import { SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { requireSeller } from '@/lib/sell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('sellerTitle'), robots: { index: false } };
}

/** Seller portal: customer messages (p10-12). */
export default async function SellerMessagesPage() {
  const seller = await requireSeller('/sell/messages');
  const [items, t] = await Promise.all([
    api<ConversationSummary[]>('/seller/messages').catch((): ConversationSummary[] => []),
    getT('inbox'),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/messages" />
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('sellerTitle')}</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          {t('sellerLead')}
        </p>
      </div>
      <section className="card">
        {items.length ? (
          <InboxList items={items} hrefBase="/sell/messages" />
        ) : (
          <p className="muted">{t('none')}</p>
        )}
      </section>
    </div>
  );
}
