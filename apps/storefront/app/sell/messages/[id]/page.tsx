import { type ConversationView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReplyForm } from '@/components/MessageForms';
import { MessageThread } from '@/components/MessageThread';
import { SellerNav } from '@/components/SellerNav';
import { api, ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { requireSeller } from '@/lib/sell';
import { reportConversation, setClosed } from '../../../account/messages/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('sellerTitle'), robots: { index: false } };
}

export default async function SellerConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const seller = await requireSeller(`/sell/messages/${id}`);
  const thread = await api<ConversationView>(`/seller/messages/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  });
  const t = await getT('inbox');
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/messages" />
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2>{thread.with}</h2>
          <span className="muted">{thread.subject}</span>
        </div>
        <Link href="/sell/messages" className="btn btn--secondary">
          {t('back')}
        </Link>
      </div>
      <section className="card stack" style={{ maxWidth: 860 }}>
        <MessageThread thread={thread} side="seller" />
        <ReplyForm id={thread.id} side="seller" />
      </section>
      <div className="subs__actions">
        <form action={setClosed}>
          <input type="hidden" name="id" value={thread.id} />
          <input type="hidden" name="closed" value={thread.closed ? 'false' : 'true'} />
          <button className="btn btn--secondary btn--sm" type="submit">
            {thread.closed ? t('reopen') : t('close')}
          </button>
        </form>
        {thread.reported ? (
          <span className="muted">{t('reported')}</span>
        ) : (
          <form action={reportConversation} className="inline-toggle">
            <input type="hidden" name="id" value={thread.id} />
            <input type="hidden" name="side" value="seller" />
            <input
              name="reason"
              required
              minLength={3}
              aria-label={t('reportReason')}
              placeholder={t('reportReason')}
            />
            <button className="btn btn--link" type="submit">
              {t('report')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
