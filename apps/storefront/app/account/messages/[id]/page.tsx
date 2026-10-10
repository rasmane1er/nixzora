import { type ConversationView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountHeader } from '@/components/AccountHeader';
import { ReplyForm } from '@/components/MessageForms';
import { MessageThread } from '@/components/MessageThread';
import { accountApi } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { reportConversation } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const thread = await accountApi<ConversationView>(
    `/me/messages/${id}`,
    `/account/messages/${id}`,
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const t = await getT('inbox');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 860 }}>
      <AccountHeader
        title={thread.with}
        description={thread.subject}
        actions={
          <Link href="/account/messages" className="btn btn--secondary">
            {t('back')}
          </Link>
        }
      />
      <p className="banner banner--info" style={{ margin: 0 }}>
        {t('safety')}
      </p>
      <section className="card stack">
        <MessageThread thread={thread} side="customer" />
        <ReplyForm id={thread.id} side="customer" />
      </section>
      {thread.reported ? (
        <p className="muted">{t('reported')}</p>
      ) : (
        <details>
          <summary className="muted">{t('report')}</summary>
          <form action={reportConversation} className="message-form" style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={thread.id} />
            <input type="hidden" name="side" value="customer" />
            <label>
              {t('reportReason')}
              <input name="reason" required minLength={3} maxLength={300} />
            </label>
            <div>
              <button className="btn btn--secondary btn--sm" type="submit">
                {t('report')}
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
